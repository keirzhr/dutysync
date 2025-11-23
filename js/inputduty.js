console.log("🔥 inputduty.js (Auto-Calculate) loaded");

// --- Global Variables ---
let currentDate = new Date();
let allDuties = [];
let completedTimeChart = null;
let unsubscribeDuties = null;

// --- Check Auth State ---
auth.onAuthStateChanged(async user => {
    if (user) {
        setupRealtimeDutiesListener(user.uid);
    } else {
        if (unsubscribeDuties) {
            unsubscribeDuties();
            unsubscribeDuties = null;
        }
    }
});

// --- Setup Real-time Firestore Listener ---
function setupRealtimeDutiesListener(userId) {
    if (unsubscribeDuties) unsubscribeDuties();

    unsubscribeDuties = db.collection("duties")
        .where("user", "==", userId)
        .onSnapshot(snapshot => {
            allDuties = snapshot.docs.map(doc => {
                const data = { id: doc.id, ...doc.data() };
                return data;
            });
            console.log("✅ Input Duty records updated (real-time):", allDuties.length);
            renderDutyLogTable();
            renderCalendar();
            renderGraph();
        }, error => {
            console.error("❌ Real-time listener error:", error);
        });
}

function renderDutyLogTable() {
    const container = document.getElementById("dutyTableBody");
    if (!container) return;

    container.innerHTML = "";
    allDuties.sort((a, b) => new Date(b.date) - new Date(a.date));

    allDuties.forEach(duty => {
        const breakdown = calculateShiftBreakdown(duty.timeIn, duty.timeOut);
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${duty.date}</td>
            <td>${duty.timeIn}</td>
            <td>${duty.timeOut}</td>
            <td>${breakdown.totalHours.toFixed(2)}</td>
            <td>Auto</td>
            <td>${duty.dayType || 'Regular'}</td>
            <td>
                <button class="edit-btn" data-id="${duty.id}">Edit</button>
                <button class="delete-btn" data-id="${duty.id}">Delete</button>
            </td>
        `;
        container.appendChild(tr);
    });

    container.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", e => {
            const id = e.currentTarget.dataset.id;
            const duty = allDuties.find(d => d.id === id);
            if (duty) openPopup(duty.date);
        });
    });

    container.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", e => {
            const id = e.currentTarget.dataset.id;
            performDelete(id);
        });
    });
}

// --- AUTOMATIC SHIFT BREAKDOWN LOGIC ---
function calculateShiftBreakdown(timeIn, timeOut) {
    if (!timeIn || !timeOut) return {
        regularHours: 0,
        nightHours: 0,
        overtimeHours: 0,
        totalHours: 0
    };

    const [inH, inM] = timeIn.split(":").map(Number);
    const [outH, outM] = timeOut.split(":").map(Number);

    let startMinutes = inH * 60 + inM;
    let endMinutes = outH * 60 + outM;

    // Handle overnight shifts
    if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
    }

    const totalMinutes = endMinutes - startMinutes;
    const totalHours = totalMinutes / 60;

    // Night shift window: 10 PM (22:00) to 6 AM (06:00)
    const nightStart = 22 * 60; // 10 PM
    const nightEnd = 6 * 60;    // 6 AM (next day)

    let regularMinutes = 0;
    let nightMinutes = 0;

    // Calculate minute-by-minute
    for (let i = 0; i < totalMinutes; i++) {
        let currentMinute = (startMinutes + i) % (24 * 60);
        
        if (currentMinute >= nightStart || currentMinute < nightEnd) {
            nightMinutes++;
        } else {
            regularMinutes++;
        }
    }

    const regularHours = regularMinutes / 60;
    const nightHours = nightMinutes / 60;

    // Overtime: Anything beyond 8 hours
    const overtimeHours = Math.max(0, totalHours - 8);

    return {
        regularHours: parseFloat(regularHours.toFixed(2)),
        nightHours: parseFloat(nightHours.toFixed(2)),
        overtimeHours: parseFloat(overtimeHours.toFixed(2)),
        totalHours: parseFloat(totalHours.toFixed(2))
    };
}

// --- Error Display Utility ---
function showError(message) {
    const errorEl = document.getElementById('popupError');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        console.warn("Validation Error:", message);
    }
}

function clearError() {
    const errorEl = document.getElementById('popupError');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
}

// --- Validation Functions ---
function validateTimeFormat(time) {
    const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
}

function validateTimeLogic(timeIn, timeOut) {
    if (!validateTimeFormat(timeIn)) {
        showError("Time In must be in HH:MM 24-hour format (e.g., 09:30)");
        return false;
    }

    if (!validateTimeFormat(timeOut)) {
        showError("Time Out must be in HH:MM 24-hour format (e.g., 17:30)");
        return false;
    }

    const [inH, inM] = timeIn.split(":").map(Number);
    const [outH, outM] = timeOut.split(":").map(Number);
    const inMinutes = inH * 60 + inM;
    const outMinutes = outH * 60 + outM;

    if (inMinutes === outMinutes) {
        showError("Time Out must be different from Time In");
        return false;
    }

    return true;
}

function validateWorkHours(timeIn, timeOut) {
    const breakdown = calculateShiftBreakdown(timeIn, timeOut);

    if (breakdown.totalHours < 0.5) {
        showError("Shift must be at least 30 minutes");
        return false;
    }

    if (breakdown.totalHours > 24) {
        showError("Shift cannot exceed 24 hours");
        return false;
    }

    return true;
}

function validateRequiredFields(date, timeIn, timeOut) {
    if (!date || !date.trim()) {
        showError("Date is required");
        return false;
    }

    if (!timeIn || !timeIn.trim()) {
        showError("Time In is required");
        return false;
    }

    if (!timeOut || !timeOut.trim()) {
        showError("Time Out is required");
        return false;
    }

    return true;
}

function validateDuplicateEntry(dateStr, excludeId = null) {
    const duplicate = allDuties.find(d => d.date === dateStr && d.id !== excludeId);
    if (duplicate) {
        showError("A duty entry already exists for this date. Edit the existing entry instead.");
        return false;
    }
    return true;
}

function validateDropdownValues(dayType) {
    const validDayTypes = ['Regular', 'Regular Holiday (130%)', 'Special Non-Working Holiday (200%)'];

    if (!validDayTypes.includes(dayType)) {
        showError("Invalid day type selection");
        return false;
    }

    return true;
}

// --- Month Navigation ---
document.getElementById('prevMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
    renderGraph();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
    renderGraph();
});

// --- Render Calendar ---
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    const container = document.getElementById('calendarContainer');
    container.innerHTML = '';

    const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        container.appendChild(header);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        container.appendChild(createDayElement(day, month - 1, year, true));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        container.appendChild(createDayElement(day, month, year, false));
    }

    const totalCells = container.children.length - 7;
    const remainingCells = 42 - totalCells;

    for (let day = 1; day <= remainingCells; day++) {
        container.appendChild(createDayElement(day, month + 1, year, true));
    }
}

function createDayElement(day, month, year, isOtherMonth) {
    const el = document.createElement('div');
    el.className = 'calendar-day';
    if (isOtherMonth) el.classList.add('other-month');

    const today = new Date();
    const actualMonth = (month % 12 + 12) % 12;
    const actualYear = month < 0 ? year - 1 : month >= 12 ? year + 1 : year;

    if (!isOtherMonth && day === today.getDate() && actualMonth === today.getMonth() && actualYear === today.getFullYear()) {
        el.classList.add('today');
    }

    const dateStr = `${actualYear}-${String(actualMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (allDuties.some(d => d.date === dateStr)) {
        el.classList.add('has-duty');
    }

    el.textContent = day;

    if (!isOtherMonth) {
        el.addEventListener('click', () => openPopup(dateStr));
    }

    return el;
}

// --- Popup Handling ---
function openPopup(dateStr) {
    clearError();
    
    document.getElementById('popupDate').value = dateStr;
    document.getElementById('popupTimeIn').value = '';
    document.getElementById('popupTimeOut').value = '';
    document.getElementById('popupDayType').value = 'Regular';

    // Clear preview
    document.getElementById('previewRegular').textContent = '0.00 hrs';
    document.getElementById('previewNight').textContent = '0.00 hrs';
    document.getElementById('previewOT').textContent = '0.00 hrs';
    document.getElementById('previewTotal').textContent = '0.00 hrs';

    const existing = allDuties.find(d => d.date === dateStr);
    const buttonsContainer = document.querySelector('.popup-buttons');

    if (existing) {
        document.getElementById('popupTimeIn').value = existing.timeIn;
        document.getElementById('popupTimeOut').value = existing.timeOut;
        document.getElementById('popupDayType').value = existing.dayType || 'Regular';
        document.getElementById('dutyPopup').dataset.editId = existing.id;

        // Show preview
        updateTimePreview();

        buttonsContainer.innerHTML = `
            <button id="deletePopupDuty" class="popup-btn popup-btn-delete">Delete</button>
            <div style="margin-left: auto; display: flex; gap: 10px;">
                <button id="updatePopupDuty" class="popup-btn popup-btn-update">Update</button>
                <button id="cancelPopupDuty" class="popup-btn popup-btn-cancel">Cancel</button>
            </div>
        `;

        document.getElementById('updatePopupDuty').addEventListener('click', saveOrUpdateDuty);
        document.getElementById('deletePopupDuty').addEventListener('click', deleteDuty);
        document.getElementById('cancelPopupDuty').addEventListener('click', closePopup);

    } else {
        delete document.getElementById('dutyPopup').dataset.editId;

        buttonsContainer.innerHTML = `
            <button id="savePopupDuty" class="popup-btn popup-btn-save">Save</button>
            <button id="cancelPopupDuty" class="popup-btn popup-btn-cancel">Cancel</button>
        `;

        document.getElementById('savePopupDuty').addEventListener('click', saveOrUpdateDuty);
        document.getElementById('cancelPopupDuty').addEventListener('click', closePopup);
    }

    // Add live preview listeners
    document.getElementById('popupTimeIn').addEventListener('input', updateTimePreview);
    document.getElementById('popupTimeOut').addEventListener('input', updateTimePreview);

    document.getElementById('popupOverlay').classList.add('active');
}

// --- Live Preview Update ---
function updateTimePreview() {
    const timeIn = document.getElementById('popupTimeIn').value;
    const timeOut = document.getElementById('popupTimeOut').value;

    if (timeIn && timeOut && validateTimeFormat(timeIn) && validateTimeFormat(timeOut)) {
        const breakdown = calculateShiftBreakdown(timeIn, timeOut);
        
        document.getElementById('previewRegular').textContent = breakdown.regularHours.toFixed(2) + ' hrs';
        document.getElementById('previewNight').textContent = breakdown.nightHours.toFixed(2) + ' hrs';
        document.getElementById('previewOT').textContent = breakdown.overtimeHours.toFixed(2) + ' hrs';
        document.getElementById('previewTotal').textContent = breakdown.totalHours.toFixed(2) + ' hrs';
    }
}

function closePopup() {
    clearError();
    document.getElementById('popupOverlay').classList.remove('active');
}

// --- SAVE / UPDATE DUTY ---
async function saveOrUpdateDuty() {
    clearError();
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
        showError("User not authenticated");
        return;
    }

    const date = document.getElementById('popupDate').value;
    const timeIn = document.getElementById('popupTimeIn').value;
    const timeOut = document.getElementById('popupTimeOut').value;
    const dayType = document.getElementById('popupDayType').value;
    const editId = document.getElementById('dutyPopup').dataset.editId;

    if (!validateRequiredFields(date, timeIn, timeOut)) return;
    if (!validateTimeLogic(timeIn, timeOut)) return;
    if (!validateWorkHours(timeIn, timeOut)) return;
    if (!validateDropdownValues(dayType)) return;
    if (!editId && !validateDuplicateEntry(date)) return;
    if (editId && !validateDuplicateEntry(date, editId)) return;

    // Calculate automatic breakdown
    const breakdown = calculateShiftBreakdown(timeIn, timeOut);

    try {
        const duty = {
            date,
            timeIn,
            timeOut,
            dayType,
            regularHours: breakdown.regularHours,
            nightHours: breakdown.nightHours,
            overtimeHours: breakdown.overtimeHours,
            totalHours: breakdown.totalHours,
            user: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editId) {
            await db.collection("duties").doc(editId).update(duty);
            console.log("Duty updated successfully");
        } else {
            await db.collection("duties").add(duty);
            console.log("Duty saved successfully");
        }

        closePopup();

    } catch (error) {
        console.error("Save error:", error);
        showError("Failed to save duty. Please try again.");
    }
}

// --- Delete Duty ---
async function deleteDuty() {
    const editId = document.getElementById('dutyPopup').dataset.editId;
    if (!editId) {
        showError("No duty record to delete");
        return;
    }

    showDeleteConfirmation(async () => {
        await performDelete(editId);
    });
}

async function performDelete(editId) {
    try {
        await db.collection("duties").doc(editId).delete();
        console.log("Duty deleted successfully");
        closePopup();
        closeDeleteConfirmation();
    } catch (error) {
        console.error("Delete error:", error);
        closeDeleteConfirmation();
        showError("Failed to delete duty. Please try again.");
    }
}

function showDeleteConfirmation(onConfirm) {
    const modal = document.getElementById('deleteConfirmationModal');
    if (!modal) return;

    modal.classList.add('active');

    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');

    const handleConfirm = async () => {
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        await onConfirm();
        confirmBtn.disabled = false;
        cancelBtn.disabled = false;
        cleanup();
    };

    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    const handleCancel = () => {
        closeDeleteConfirmation();
        cleanup();
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
}

function closeDeleteConfirmation() {
    const modal = document.getElementById('deleteConfirmationModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// --- Render Graph ---
function renderGraph() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthDuties = allDuties.filter(d => {
        const [y, m] = d.date.split("-").map(Number);
        return y === year && m === month + 1;
    });

    const dates = monthDuties.map(d => d.date);
    const hours = monthDuties.map(d => d.totalHours || 0);

    const ctx = document.getElementById("completedTimeChart");
    if (!ctx) return;

    if (completedTimeChart) completedTimeChart.destroy();

    completedTimeChart = new Chart(ctx.getContext("2d"), {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Hours Worked',
                data: hours,
                backgroundColor: 'rgba(90,112,176,0.7)',
                borderColor: 'rgba(90,112,176,1)',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    calculateCutoffHours(monthDuties);
}

// --- Cutoff Hours ---
function calculateCutoffHours(duties) {
    let hours_1_15 = 0;
    let hours_16_end = 0;

    duties.forEach(d => {
        const day = new Date(d.date).getDate();
        const totalPayableTime = d.totalHours || 0;

        if (day <= 15) { 
            hours_1_15 += totalPayableTime;
        } else { 
            hours_16_end += totalPayableTime;
        }
    });

    document.getElementById("hours_1_15").textContent = hours_1_15.toFixed(2) + " hrs";
    document.getElementById("hours_16_30").textContent = hours_16_end.toFixed(2) + " hrs";
}

// --- Cleanup ---
window.addEventListener('beforeunload', () => {
    if (unsubscribeDuties) unsubscribeDuties();
});