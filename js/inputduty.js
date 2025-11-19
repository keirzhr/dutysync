console.log("🔥 inputduty.js (Calendar) loaded");

// --- Global Variables ---
let currentDate = new Date();
let allDuties = [];
let completedTimeChart = null;

// --- Check Auth State ---
auth.onAuthStateChanged(async user => {
    if (user) {
        await loadDutyRecords();
        renderCalendar();
        renderGraph();
    }
});

// --- Calculate Hours ---
function calculateHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return 0;
    const [inH, inM] = timeIn.split(":").map(Number);
    const [outH, outM] = timeOut.split(":").map(Number);

    let start = inH + inM / 60;
    let end = outH + outM / 60;

    if (end < start) end += 24;
    return +(end - start).toFixed(2);
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

    // Update header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    const container = document.getElementById('calendarContainer');
    container.innerHTML = '';

    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        container.appendChild(header);
    });

    // Get first day and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dayEl = createDayElement(day, month - 1, year, true);
        container.appendChild(dayEl);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = createDayElement(day, month, year, false);
        container.appendChild(dayEl);
    }

    // Next month days
    const totalCells = container.children.length - 7;
    const remainingCells = 42 - totalCells;
    for (let day = 1; day <= remainingCells; day++) {
        const dayEl = createDayElement(day, month + 1, year, true);
        container.appendChild(dayEl);
    }
}

function createDayElement(day, month, year, isOtherMonth) {
    const el = document.createElement('div');
    el.className = 'calendar-day';
    if (isOtherMonth) el.classList.add('other-month');

    // Check if today
    const today = new Date();
    const actualMonth = (month % 12 + 12) % 12;
    const actualYear = month < 0 ? year - 1 : month >= 12 ? year + 1 : year;

    if (!isOtherMonth && day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        el.classList.add('today');
    }

    // Check if has duty
    const dateStr = `${actualYear}-${String(actualMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (allDuties.some(d => d.date === dateStr)) {
        el.classList.add('has-duty');
    }

    el.textContent = day;

    if (!isOtherMonth) {
        el.addEventListener('click', () => {
            openPopup(dateStr);
        });
    }

    return el;
}

// --- Popup Handling ---
function openPopup(dateStr) {
    document.getElementById('popupDate').value = dateStr;
    document.getElementById('popupTimeIn').value = '';
    document.getElementById('popupTimeOut').value = '';
    document.getElementById('popupRate').value = 'Regular Rate';
    document.getElementById('popupOverTime').value = '';
    document.getElementById('popupSpecialDay').value = 'None';

    // Check if editing existing
    const existing = allDuties.find(d => d.date === dateStr);
    const buttonsContainer = document.querySelector('.popup-buttons');
    
    if (existing) {
        document.getElementById('popupTimeIn').value = existing.timeIn;
        document.getElementById('popupTimeOut').value = existing.timeOut;
        document.getElementById('popupRate').value = existing.rate;
        document.getElementById('popupOverTime').value = existing.overTime;
        document.getElementById('popupSpecialDay').value = existing.specialDay;
        document.getElementById('dutyPopup').dataset.editId = existing.id;
        
        // Show Update, Delete and Cancel buttons
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
        
        // Show Save and Cancel buttons
        buttonsContainer.innerHTML = `
            <button id="savePopupDuty" class="popup-btn popup-btn-save">Save</button>
            <button id="cancelPopupDuty" class="popup-btn popup-btn-cancel">Cancel</button>
        `;
        
        document.getElementById('savePopupDuty').addEventListener('click', saveOrUpdateDuty);
        document.getElementById('cancelPopupDuty').addEventListener('click', closePopup);
    }

    document.getElementById('popupOverlay').classList.add('active');
}

function closePopup() {
    document.getElementById('popupOverlay').classList.remove('active');
}

async function saveOrUpdateDuty() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        alert('You must be logged in');
        return;
    }

    const date = document.getElementById('popupDate').value;
    const timeIn = document.getElementById('popupTimeIn').value;
    const timeOut = document.getElementById('popupTimeOut').value;
    const rate = document.getElementById('popupRate').value;
    const overTime = document.getElementById('popupOverTime').value;
    const specialDay = document.getElementById('popupSpecialDay').value;

    if (!date || !timeIn || !timeOut) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        const duty = {
            date, timeIn, timeOut, rate, overTime, specialDay,
            user: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        const editId = document.getElementById('dutyPopup').dataset.editId;

        if (editId) {
            await db.collection("duties").doc(editId).update(duty);
            alert("Duty updated successfully!");
        } else {
            await db.collection("duties").add(duty);
            alert("Duty saved successfully!");
        }

        closePopup();
        await loadDutyRecords();
        renderCalendar();
        renderGraph();

    } catch (error) {
        console.error("Save Error:", error);
        alert("Failed to save duty.");
    }
}

async function deleteDuty() {
    if (!confirm('Are you sure you want to delete this duty record?')) {
        return;
    }

    const editId = document.getElementById('dutyPopup').dataset.editId;
    
    if (!editId) {
        alert('No duty record to delete');
        return;
    }

    try {
        await db.collection("duties").doc(editId).delete();
        alert("Duty deleted successfully!");
        closePopup();
        await loadDutyRecords();
        renderCalendar();
        renderGraph();
    } catch (error) {
        console.error("Delete Error:", error);
        alert("Failed to delete duty.");
    }
}

// --- Load Duty Records ---
async function loadDutyRecords() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
        const snapshot = await db.collection("duties")
            .where("user", "==", currentUser.uid)
            .get();

        allDuties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Duties loaded:", allDuties);
    } catch (error) {
        console.error("Load duties error:", error);
    }
}

// --- Render Graph ---
function renderGraph() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Filter duties for current month
    const monthDuties = allDuties.filter(d => {
        const [y, m] = d.date.split('-').map(Number);
        return y === year && m === month + 1;
    });

    const dates = monthDuties.map(d => d.date);
    const hours = monthDuties.map(d => calculateHours(d.timeIn, d.timeOut));

    const ctx = document.getElementById('completedTimeChart');
    if (!ctx) return;

    const context = ctx.getContext('2d');

    if (completedTimeChart) {
        completedTimeChart.destroy();
    }

    completedTimeChart = new Chart(context, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Hours Worked',
                data: hours,
                backgroundColor: 'rgba(90, 112, 176, 0.7)',
                borderColor: 'rgba(90, 112, 176, 1)',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            },
            plugins: {
                legend: { display: true, position: 'top' }
            }
        }
    });
}