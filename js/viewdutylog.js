console.log("📋 viewdutylog.js loaded (v3 - Final Design)");

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
// Checks if user is logged in, then starts listening for data
auth.onAuthStateChanged(async user => {
    if (user) {
        console.log("👤 User detected:", user.uid);
        initializeMonthFilter();
        setupRealtimeDutyListener(user.uid);
    } else {
        console.log("👤 No user logged in.");
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
    console.log("📡 Setting up real-time listener...");
    if (unsubscribeDutyLog) unsubscribeDutyLog();

    unsubscribeDutyLog = db.collection("duties")
        .where("user", "==", userId)
        .onSnapshot(snapshot => {
            dutyLogRecords = snapshot.docs.map(doc => {
                const data = { id: doc.id, ...doc.data() };
                // Ensure numerical values
                data.hours = calculateDutyHours(data.timeIn, data.timeOut);
                data.overTime = parseFloat(data.overTime) || 0;
                return data;
            });
            console.log(`✅ Fetched ${dutyLogRecords.length} records total.`);
            renderDutyLog();
        }, error => {
            console.error("❌ Real-time listener error:", error);
            alert("Error fetching data. Check console for details.");
        });
}

// --- Filter Records by Selected Month ---
function filterRecordsByMonth(records) {
    if (!selectedMonth) {
        // Default to current month if null
        const today = new Date();
        selectedMonth = today.toISOString().slice(0, 7);
    }
    // Assumes record.date is "YYYY-MM-DD" string
    return records.filter(record => record.date && record.date.slice(0, 7) === selectedMonth);
}

// --- Format Date Helper ---
function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// --- MAIN RENDER FUNCTION ---
function renderDutyLog() {
    console.log("🎨 Rendering UI...");

    const filteredRecords = filterRecordsByMonth(dutyLogRecords);
    // Sort newest first
    const sortedRecords = [...filteredRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log(`📊 Displaying ${sortedRecords.length} records for month: ${selectedMonth}`);

    // 1. Desktop Table
    const tbody = document.getElementById('dutyTableBody');
    if (tbody) {
        if (sortedRecords.length === 0) {
            renderEmptyTableState(tbody);
        } else {
            renderDesktopTable(tbody, sortedRecords);
        }
    }

    // 2. Dashboard Stats
    renderMiniDashboard(sortedRecords);

    // 3. Mobile Cards (The Swipeable Column Design)
    renderMobileCards(sortedRecords);
}

// --- Render Empty State ---
function renderEmptyTableState(tbody) {
    tbody.innerHTML = `
        <tr class="empty-row">
            <td colspan="8" class="empty-cell">
                <i class="fas fa-inbox" style="font-size: 24px; color: #ccc; margin-bottom: 8px;"></i><br>
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

// --- Render Mobile Cards (FINAL DESIGN) ---
function renderMobileCards(records) {
    const cardsWrapper = document.getElementById('dutyCardsWrapper');
    if (!cardsWrapper) return;

    cardsWrapper.innerHTML = '';

    // If no records, hide the wrapper or show empty msg
    if (records.length === 0) {
        cardsWrapper.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No records for this month</div>';
        return;
    }

    records.forEach(record => {
        const card = document.createElement('div');
        card.className = 'duty-card';
        
        // Data Helpers
        const dayTypeClass = (record.dayType || 'regular').toLowerCase().replace(/ /g, '-');
        
        // Date Parsing
        const dateObj = new Date(record.date);
        const dayNumber = dateObj.getDate(); // e.g., 21
        const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric', weekday: 'short' });

        // OT Logic
        const otDisplay = record.overTime > 0 
            ? `<div class="stat-ot">+${record.overTime.toFixed(2)} OT</div>` 
            : `<div class="stat-ot" style="opacity:0.5">No OT</div>`;

        card.innerHTML = `
            <div class="duty-card-header">
                <div class="date-group">
                    <span class="date-day">Day ${dayNumber}</span>
                    <span class="date-full">${dateString}</span>
                </div>
                <span class="status-badge ${dayTypeClass}">${record.dayType || 'Regular'}</span>
            </div>

            <div class="duty-card-body">
                
                <div class="col-timeline">
                    <div class="time-node">
                        <span class="time-label">Time In</span>
                        <span class="time-value">${record.timeIn}</span>
                    </div>
                    <div class="time-node">
                        <span class="time-label">Time Out</span>
                        <span class="time-value">${record.timeOut}</span>
                    </div>
                </div>

                <div class="col-stats">
                    <span class="stat-big">${record.hours.toFixed(2)}</span>
                    <span class="stat-label">Hrs</span>
                    ${otDisplay}
                </div>
            </div>

            <div class="duty-card-footer">
                <div class="rate-text">
                    <i class="fas fa-money-bill-wave"></i> ${record.compensationType || 'Regular Rate'}
                </div>
                <div class="card-actions">
                    <button class="action-btn edit-btn" onclick="editDutyRecord('${record.id}')">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteDutyRecord('${record.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        cardsWrapper.appendChild(card);
    });
    
    // Ensure wrapper is visible
    cardsWrapper.style.display = 'flex'; 
}

// --- Render Mini Dashboard Stats ---
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

        const isHolidayOrSpecial = dayType.includes('Holiday') || dayType.includes('Special');
        const isNightShift = rate && rate.toLowerCase().includes('night'); 

        if (isHolidayOrSpecial) {
            specialDayHours += hours;
        }
        if (isNightShift) {
            nightHours += hours;
        }
        if (!isHolidayOrSpecial && !isNightShift) {
            regularHours += hours;
        }

        overTimeHours += overtime;
    });

    const expectedHours = 22 * 8;
    const availability = expectedHours > 0 ? (totalHours / expectedHours) * 100 : 0;

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.textContent = val;
    };

    setText('dashTotalHours', totalHours.toFixed(2));
    setText('dashRegularHours', regularHours.toFixed(2));
    setText('dashNightHours', nightHours.toFixed(2));
    setText('dashSpecialDayHours', specialDayHours.toFixed(2));
    setText('dashOverTimeHours', overTimeHours.toFixed(2));
    setText('dashAvailability', '%' + availability.toFixed(2));
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

    try {
        await db.collection("duties").doc(id).update({
            date, timeIn, timeOut, compensationType: rate,
            overTime, dayType, hours,
            // Ensure we don't overwrite the user accidentally, but usually good to keep
            user: auth.currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeEditModal();
    } catch (error) {
        console.error(error);
        showEditError("Failed to update duty.");
    }
};

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
            await db.collection("duties").doc(id).delete();
            closeDutyLogDeleteModal();
        } catch(e) {
            console.error(e);
            alert("Delete failed");
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
    if (modal) modal.classList.remove('active');
}

window.addEventListener('beforeunload', () => {
    if (unsubscribeDutyLog) unsubscribeDutyLog();
});