console.log("📋 viewdutylog.js loaded (FIXED Auto-Calculate Display)");

// --- Global Variables ---
let dutyLogRecords = [];
let unsubscribeDutyLog = null;
let selectedMonth = null;

// --- Initialize Month Filter to Current Month ---
function initializeMonthFilter() {
    const monthFilterInput = document.getElementById('monthFilter');
    if (!monthFilterInput) return;

    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    monthFilterInput.value = currentMonth;
    selectedMonth = currentMonth;
    console.log("📅 Month filter initialized to:", currentMonth);
}

// --- Auth State Observer ---
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

// --- Setup Real-time Firestore Listener ---
function setupRealtimeDutyListener(userId) {
    console.log("📡 Setting up real-time listener...");
    if (unsubscribeDutyLog) unsubscribeDutyLog();

    unsubscribeDutyLog = db.collection("duties")
        .where("user", "==", userId)
        .onSnapshot(snapshot => {
            dutyLogRecords = snapshot.docs.map(doc => {
                const data = { id: doc.id, ...doc.data() };
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
        const today = new Date();
        selectedMonth = today.toISOString().slice(0, 7);
    }
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

    // 3. Mobile Cards
    renderMobileCards(sortedRecords);
}

// --- Render Empty State ---
function renderEmptyTableState(tbody) {
    tbody.innerHTML = `
        <tr class="empty-row">
            <td colspan="7" class="empty-cell">
                <i class="fas fa-inbox" style="font-size: 24px; color: #ccc; margin-bottom: 8px;"></i><br>
                <span>No duty records found for this month</span>
            </td>
        </tr>
    `;
}

// --- Render Desktop Table (FIXED) ---
function renderDesktopTable(tbody, records) {
    tbody.innerHTML = '';
    records.forEach(record => {
        const row = document.createElement('tr');
        
        // Handle both old and new data structures
        const totalHours = record.totalHours || record.hours || 0;
        const nightHours = record.nightHours || 0;
        const overtimeHours = record.overtimeHours || record.overTime || 0;

        row.innerHTML = `
            <td data-label="Date">${formatDate(record.date)}</td>
            <td data-label="Time In">${record.timeIn}</td>
            <td data-label="Time Out">${record.timeOut}</td>
            <td data-label="Total Hours"><strong>${totalHours.toFixed(2)}</strong></td>
            <td data-label="Night Diff">${nightHours > 0 ? nightHours.toFixed(2) + ' hrs' : '-'}</td>
            <td data-label="Day Type">${record.dayType || 'Regular'}</td>
            <td data-label="Overtime">${overtimeHours > 0 ? overtimeHours.toFixed(2) + ' hrs' : '-'}</td>
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

// --- Render Mobile Cards ---
function renderMobileCards(records) {
    const cardsWrapper = document.getElementById('dutyCardsWrapper');
    if (!cardsWrapper) return;

    cardsWrapper.innerHTML = '';

    if (records.length === 0) {
        cardsWrapper.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No records for this month</div>';
        return;
    }

    records.forEach(record => {
        const card = document.createElement('div');
        card.className = 'duty-card';
        
        const dayTypeClass = (record.dayType || 'regular').toLowerCase().replace(/ /g, '-');
        
        const dateObj = new Date(record.date);
        const dayNumber = dateObj.getDate();
        const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric', weekday: 'short' });

        // Handle both old and new data structures
        const totalHours = record.totalHours || record.hours || 0;
        const nightHours = record.nightHours || 0;
        const overtimeHours = record.overtimeHours || record.overTime || 0;

        const otDisplay = overtimeHours > 0 
            ? `<div class="stat-ot">+${overtimeHours.toFixed(2)} OT</div>` 
            : `<div class="stat-ot" style="opacity:0.5">No OT</div>`;

        const nightDisplay = nightHours > 0
            ? `<div class="stat-night">🌙 ${nightHours.toFixed(2)} Night</div>`
            : '';

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
                    <span class="stat-big">${totalHours.toFixed(2)}</span>
                    <span class="stat-label">Hrs</span>
                    ${otDisplay}
                    ${nightDisplay}
                </div>
            </div>

            <div class="duty-card-footer">
                <div class="rate-text">
                    <i class="fas fa-robot"></i> Auto-Calculated
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
    
    cardsWrapper.style.display = 'flex'; 
}

// --- Render Mini Dashboard Stats (FIXED) ---
function renderMiniDashboard(records) {
    let totalHours = 0;
    let basicHours = 0; // Renamed from regularHours for clarity
    let nightHours = 0;
    let specialDayHours = 0;
    let overTimeHours = 0;

    records.forEach(record => {
        // 1. Get the raw values
        const total = record.totalHours || record.hours || 0;
        const night = record.nightHours || 0;
        const overtime = record.overtimeHours || record.overTime || 0;
        const dayType = record.dayType || 'Regular';

        // 2. Calculate the 'Basic Pay' hours (Total Duration - Overtime)
        // This ensures we don't double count the OT hours in the 'Regular' bucket
        const basic = Math.max(0, total - overtime);

        // 3. Accumulate
        totalHours += total;
        basicHours += basic; // Add to our new Basic/Regular bucket
        nightHours += night;
        overTimeHours += overtime;

        if (dayType.includes('Holiday') || dayType.includes('Special')) {
            specialDayHours += total;
        }
    });

    const expectedHours = 22 * 8; // Approx 22 working days
    const availability = expectedHours > 0 ? (totalHours / expectedHours) * 100 : 0;

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.textContent = val;
    };

    // Update the UI
    setText('dashTotalHours', totalHours.toFixed(2));
    setText('dashRegularHours', basicHours.toFixed(2)); // Now displays Basic Hours (8.00)
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
    document.getElementById('editDutyDayType').value = record.dayType || 'Regular';
    
    // Show current auto-calculated values
    updateEditPreview();
    
    // Add live preview listeners
    document.getElementById('editDutyTimeIn').addEventListener('input', updateEditPreview);
    document.getElementById('editDutyTimeOut').addEventListener('input', updateEditPreview);
    
    modal.classList.add('active');
}

function updateEditPreview() {
    const timeIn = document.getElementById('editDutyTimeIn').value;
    const timeOut = document.getElementById('editDutyTimeOut').value;

    if (timeIn && timeOut) {
        const breakdown = calculateShiftBreakdown(timeIn, timeOut);
        document.getElementById('editPreviewRegular').textContent = breakdown.regularHours.toFixed(2) + ' hrs';
        document.getElementById('editPreviewNight').textContent = breakdown.nightHours.toFixed(2) + ' hrs';
        document.getElementById('editPreviewOT').textContent = breakdown.overtimeHours.toFixed(2) + ' hrs';
        document.getElementById('editPreviewTotal').textContent = breakdown.totalHours.toFixed(2) + ' hrs';
    }
}

// Reuse the same calculation logic
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

    if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
    }

    const totalMinutes = endMinutes - startMinutes;
    const totalHours = totalMinutes / 60;

    const nightStart = 22 * 60;
    const nightEnd = 6 * 60;

    let regularMinutes = 0;
    let nightMinutes = 0;

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
    const overtimeHours = Math.max(0, totalHours - 8);

    return {
        regularHours: parseFloat(regularHours.toFixed(2)),
        nightHours: parseFloat(nightHours.toFixed(2)),
        overtimeHours: parseFloat(overtimeHours.toFixed(2)),
        totalHours: parseFloat(totalHours.toFixed(2))
    };
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
    const dayType = document.getElementById('editDutyDayType').value;

    if (!date || !timeIn || !timeOut) return showEditError("Date, Time In, and Time Out are required");
    
    const breakdown = calculateShiftBreakdown(timeIn, timeOut);
    if (breakdown.totalHours < 0.5) return showEditError("Shift must be at least 30 minutes");

    try {
        await db.collection("duties").doc(id).update({
            date, timeIn, timeOut, dayType,
            regularHours: breakdown.regularHours,
            nightHours: breakdown.nightHours,
            overtimeHours: breakdown.overtimeHours,
            totalHours: breakdown.totalHours,
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