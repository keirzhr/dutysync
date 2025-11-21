console.log("📋 viewdutylog.js loaded (Real-time enabled)");

// --- Global Variables ---
let dutyLogRecords = [];
let unsubscribeDutyLog = null;
let selectedMonth = null;

// --- Initialize Month Filter to Current Month ---
function initializeMonthFilter() {
    const monthFilterInput = document.getElementById('monthFilter');
    if (!monthFilterInput) return;

    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
    monthFilterInput.value = currentMonth;
    selectedMonth = currentMonth;
    console.log("📅 Month filter initialized to:", currentMonth);
}

// --- Auth State Observer ---
auth.onAuthStateChanged(async user => {
    if (user) {
        initializeMonthFilter();
        setupRealtimeDutyListener(user.uid);
    } else {
        if (unsubscribeDutyLog) {
            unsubscribeDutyLog();
            unsubscribeDutyLog = null;
        }
    }
});

// --- Month Filter Change Event ---
const monthFilterInput = document.getElementById('monthFilter');
if (monthFilterInput) {
    monthFilterInput.addEventListener('change', (e) => {
        selectedMonth = e.target.value;
        console.log("📅 Month filter changed to:", selectedMonth);
        renderDutyLog();
    });
}

// --- Calculate Hours ---
function calculateDutyHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return 0;
    const [inH, inM] = timeIn.split(":").map(Number);
    const [outH, outM] = timeOut.split(":").map(Number);

    let start = inH + inM / 60;
    let end = outH + outM / 60;

    if (end < start) end += 24;
    return +(end - start).toFixed(2);
}

// --- Setup Real-time Firestore Listener ---
function setupRealtimeDutyListener(userId) {
    if (unsubscribeDutyLog) unsubscribeDutyLog();

    unsubscribeDutyLog = db.collection("duties")
        .where("user", "==", userId)
        .onSnapshot(snapshot => {
            dutyLogRecords = snapshot.docs.map(doc => {
                const data = { id: doc.id, ...doc.data() };
                data.hours = calculateDutyHours(data.timeIn, data.timeOut);
                data.overTime = parseFloat(data.overTime) || 0;
                return data;
            });
            console.log("✅ Duty log records updated (real-time):", dutyLogRecords.length);
            renderDutyLog();
        }, error => {
            console.error("❌ Real-time listener error:", error);
        });
}

// --- Filter Records by Selected Month ---
function filterRecordsByMonth(records) {
    if (!selectedMonth) {
        const today = new Date();
        selectedMonth = today.toISOString().slice(0, 7);
    }
    return records.filter(record => record.date && record.date.slice(0, 7) === selectedMonth);
}

// --- Format Date ---
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// --- Render Duty Log ---
function renderDutyLog() {
    console.log("📄 Rendering duty log...");

    const filteredRecords = filterRecordsByMonth(dutyLogRecords);
    const sortedRecords = [...filteredRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log("📊 Filtered records:", sortedRecords.length);

    const tableWrapper = document.querySelector('.duty-table-wrapper');
    const tbody = document.getElementById('dutyTableBody');

    if (!tableWrapper || !tbody) {
        console.error("❌ Required DOM elements not found!");
        return;
    }

    if (sortedRecords.length === 0) {
        renderEmptyTableState(tbody);
        renderMiniDashboard([]);
        renderMobileCards([]);
    } else {
        renderDesktopTable(tbody, sortedRecords);
        renderMiniDashboard(sortedRecords);
        renderMobileCards(sortedRecords);
    }
}

// --- Empty Table ---
function renderEmptyTableState(tbody) {
    tbody.innerHTML = `
        <tr class="empty-row">
            <td colspan="8" class="empty-cell">
                <i class="fas fa-inbox"></i>
                <span>No duty records found for this month</span>
            </td>
        </tr>
    `;
}

// --- Render Desktop Table ---
function renderDesktopTable(tbody, records) {
    tbody.innerHTML = '';

    records.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Date">${formatDate(record.date)}</td>
            <td data-label="Time In">${record.timeIn}</td>
            <td data-label="Time Out">${record.timeOut}</td>
            <td data-label="Hours"><strong>${record.hours.toFixed(2)}</strong></td>
            <td data-label="Rate">${record.compensationType || 'Regular Rate'}</td>
            <td data-label="Day Type">${record.dayType || 'Regular'}</td>
            <td data-label="Overtime">${record.overTime > 0 ? record.overTime.toFixed(2) + ' hrs' : '-'}</td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="action-btn edit-btn" onclick="editDutyRecord('${record.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteDutyRecord('${record.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// --- Render Mini Dashboard ---
function renderMiniDashboard(records) {
    let totalHours = 0;
    let regularHours = 0;
    let nightHours = 0;
    let specialDayHours = 0;
    let overTimeHours = 0;

    records.forEach(record => {
        const hours = record.hours || 0;
        const overtime = record.overTime || 0;
        const rate = record.compensationType || 'Regular Rate';
        const dayType = record.dayType || 'Regular';

        totalHours += hours + overtime;

        // --- FIXED LOGIC START --- 
        // We decouple the checks so a shift can count as BOTH Night AND Special if applicable.

        const isHolidayOrSpecial = dayType.includes('Holiday') || dayType.includes('Special');
        const isNightShift = rate && rate.toLowerCase().includes('night'); // Checks for 'Night Shift' or 'Night Diff'

        // 1. Calculate Special Day Hours (Holiday/Special)
        if (isHolidayOrSpecial) {
            specialDayHours += hours;
        }

        // 2. Calculate Night Differential (Regardless if it's a holiday or not)
        if (isNightShift) {
            nightHours += hours;
        }

        // 3. Calculate Regular Hours
        // Count as regular only if it is NOT a holiday AND NOT a night shift
        if (!isHolidayOrSpecial && !isNightShift) {
            regularHours += hours;
        }
        // --- FIXED LOGIC END ---

        overTimeHours += overtime;
    });

    // Calculate availability (assuming 22 working days per month * 8 hours)
    const expectedHours = 22 * 8;
    const availability = (totalHours / expectedHours) * 100;

    // Update dashboard elements
    const totalHoursEl = document.getElementById('dashTotalHours');
    const regularEl = document.getElementById('dashRegularHours');
    const nightEl = document.getElementById('dashNightHours');
    const specialEl = document.getElementById('dashSpecialDayHours');
    const overtimeEl = document.getElementById('dashOverTimeHours');
    const availabilityEl = document.getElementById('dashAvailability');

    if (totalHoursEl) totalHoursEl.textContent = totalHours.toFixed(2);
    if (regularEl) regularEl.textContent = regularHours.toFixed(2);
    if (nightEl) nightEl.textContent = nightHours.toFixed(2);
    if (specialEl) specialEl.textContent = specialDayHours.toFixed(2);
    if (overtimeEl) overtimeEl.textContent = overTimeHours.toFixed(2);
    if (availabilityEl) availabilityEl.textContent = '%' + availability.toFixed(2);

    console.log(`📊 Dashboard - Total: ${totalHours.toFixed(2)}, Regular: ${regularHours.toFixed(2)}, Night: ${nightHours.toFixed(2)}, Special: ${specialDayHours.toFixed(2)}, OT: ${overTimeHours.toFixed(2)}, Availability: ${availability.toFixed(2)}%`);
}

// --- Edit/Delete Functions ---
window.editDutyRecord = function(id) {
    const record = dutyLogRecords.find(r => r.id === id);
    if (!record) return console.error("Record not found:", id);
    openEditModal(record);
};

window.deleteDutyRecord = function(id) {
    showDutyLogDeleteConfirmation(id);
};

// --- Edit Modal ---
function openEditModal(record) {
    const modal = document.getElementById('dutyLogEditModal');
    if (!modal) return;

    clearEditError();
    document.getElementById('editDutyId').value = record.id;

    const dateInput = document.getElementById('editDutyDate');
    dateInput.value = record.date;
    dateInput.readOnly = true;

    document.getElementById('editDutyTimeIn').value = record.timeIn;
    document.getElementById('editDutyTimeOut').value = record.timeOut;
    document.getElementById('editDutyRate').value = record.compensationType || 'Regular Rate';
    document.getElementById('editDutyDayType').value = record.dayType || 'Regular';
    document.getElementById('editDutyOvertime').value = record.overTime || 0;

    modal.classList.add('active');
}

function closeEditModal() {
    const modal = document.getElementById('dutyLogEditModal');
    if (modal) modal.classList.remove('active');
    clearEditError();
}

function clearEditError() {
    const el = document.getElementById('editDutyError');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function showEditError(msg) {
    const el = document.getElementById('editDutyError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

window.saveEditedDuty = async function() {
    clearEditError();

    const id = document.getElementById('editDutyId').value;
    const date = document.getElementById('editDutyDate').value;
    const timeIn = document.getElementById('editDutyTimeIn').value;
    const timeOut = document.getElementById('editDutyTimeOut').value;
    const rate = document.getElementById('editDutyRate').value;
    const dayType = document.getElementById('editDutyDayType').value;
    const overTime = parseFloat(document.getElementById('editDutyOvertime').value) || 0;

    if (!date || !timeIn || !timeOut) return showEditError("Date, Time In, and Time Out are required");

    const hours = calculateDutyHours(timeIn, timeOut);
    if (hours < 0.5) return showEditError("Shift must be at least 30 minutes");
    if (hours > 24) return showEditError("Shift cannot exceed 24 hours");

    try {
        await db.collection("duties").doc(id).update({
            date, timeIn, timeOut, compensationType: rate,
            overTime, dayType, hours,
            user: auth.currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeEditModal();
    } catch (error) {
        console.error(error);
        showEditError("Failed to update duty. Try again.");
    }
};

// --- Delete Modal ---
function showDutyLogDeleteConfirmation(id) {
    const modal = document.getElementById('dutyLogDeleteModal');
    if (!modal) return;
    modal.classList.add('active');

    const confirmBtn = document.getElementById('confirmDutyLogDelete');
    const cancelBtn = document.getElementById('cancelDutyLogDelete');

    let isProcessing = false;

    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    const handleConfirm = async () => {
        if (isProcessing) return;
        isProcessing = true;
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;

        try {
            await performDutyLogDelete(id);
            closeDutyLogDeleteModal();
        } finally {
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
            cleanup();
        }
    };

    const handleCancel = () => {
        closeDutyLogDeleteModal();
        cleanup();
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
}

function closeDutyLogDeleteModal() {
    const modal = document.getElementById('dutyLogDeleteModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function performDutyLogDelete(id) {
    try {
        await db.collection("duties").doc(id).delete();
        console.log("✅ Duty record deleted successfully");
    } catch (error) {
        console.error("❌ Delete error:", error);
        alert("Failed to delete duty record.");
    }
}

// --- Cleanup ---
window.addEventListener('beforeunload', () => {
    if (unsubscribeDutyLog) unsubscribeDutyLog();
});

// --- Render Mobile Cards ---
function renderMobileCards(records) {
    const cardsWrapper = document.getElementById('dutyCardsWrapper');
    if (!cardsWrapper) return;

    cardsWrapper.innerHTML = '';

    if (records.length === 0) {
        cardsWrapper.style.display = 'none';
        return;
    }

    records.forEach(record => {
        const card = document.createElement('div');
        card.className = 'duty-card';
        card.innerHTML = `
            <div class="card-row"><strong>Date:</strong> ${formatDate(record.date)}</div>
            <div class="card-row"><strong>Time In:</strong> ${record.timeIn}</div>
            <div class="card-row"><strong>Time Out:</strong> ${record.timeOut}</div>
            <div class="card-row"><strong>Hours:</strong> ${record.hours.toFixed(2)}</div>
            <div class="card-row"><strong>Rate:</strong> ${record.compensationType || 'Regular Rate'}</div>
            <div class="card-row"><strong>Day Type:</strong> ${record.dayType || 'Regular'}</div>
            <div class="card-row"><strong>Overtime:</strong> ${record.overTime > 0 ? record.overTime.toFixed(2) + ' hrs' : '-'}</div>
            <div class="card-actions">
                <button class="action-btn edit-btn" onclick="editDutyRecord('${record.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteDutyRecord('${record.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        cardsWrapper.appendChild(card);
    });

    cardsWrapper.style.display = 'block';
}