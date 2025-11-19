console.log("📋 viewdutylog.js loaded");

// --- Global Variables ---
let dutyLogRecords = [];
let sortOrder = 'desc'; // Default: newest first

// --- Auth State Observer ---
auth.onAuthStateChanged(async user => {
    if (user) {
        await loadDutyLogRecords();
        renderDutyLog();
    }
});

// --- Sort Control ---
const sortByDateSelect = document.getElementById('sortByDate');
if (sortByDateSelect) {
    sortByDateSelect.addEventListener('change', (e) => {
        sortOrder = e.target.value;
        renderDutyLog();
    });
}

// --- Calculate Hours (reuse from inputduty.js) ---
function calculateDutyHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return 0;
    const [inH, inM] = timeIn.split(":").map(Number);
    const [outH, outM] = timeOut.split(":").map(Number);

    let start = inH + inM / 60;
    let end = outH + outM / 60;

    if (end < start) end += 24; // Overnight shift
    return +(end - start).toFixed(2);
}

// --- Load Duty Records from Firestore ---
async function loadDutyLogRecords() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
        const snapshot = await db.collection("duties")
            .where("user", "==", currentUser.uid)
            .get();

        dutyLogRecords = snapshot.docs.map(doc => {
            const data = { id: doc.id, ...doc.data() };
            data.hours = calculateDutyHours(data.timeIn, data.timeOut);
            return data;
        });

        console.log("Duty log records loaded:", dutyLogRecords);

    } catch (error) {
        console.error("Error loading duty log records:", error);
    }
}

// --- Format Date for Display ---
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// --- Render Duty Log ---
function renderDutyLog() {
    // Sort records
    const sortedRecords = [...dutyLogRecords].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // Check if empty
    const emptyState = document.getElementById('dutyEmptyState');
    const tableWrapper = document.querySelector('.duty-table-wrapper');
    const cardsWrapper = document.getElementById('dutyCardsWrapper');
    const summaryMobile = document.getElementById('dutySummaryMobile');

    if (sortedRecords.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (cardsWrapper) cardsWrapper.style.display = 'none';
        if (summaryMobile) summaryMobile.style.display = 'none';
        return;
    } else {
        if (emptyState) emptyState.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (cardsWrapper) cardsWrapper.style.display = 'flex';
        if (summaryMobile) summaryMobile.style.display = 'block';
    }

    // Render Desktop Table
    renderDesktopTable(sortedRecords);

    // Render Mobile Cards
    renderMobileCards(sortedRecords);

    // Calculate and display summary
    renderSummary(sortedRecords);
}

// --- Render Desktop Table ---
function renderDesktopTable(records) {
    const tbody = document.getElementById('dutyTableBody');
    if (!tbody) return;

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
            <td data-label="Overtime">${record.overTime ? record.overTime + ' hrs' : 'None'}</td>
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

    records.forEach(record => {
        const card = document.createElement('div');
        card.className = 'duty-card';
        card.innerHTML = `
            <div class="duty-card-header">
                <div class="duty-card-date">
                    <i class="fas fa-calendar"></i>
                    <span>${formatDate(record.date)}</span>
                </div>
                <div class="duty-card-hours">
                    <strong>${record.hours.toFixed(2)}</strong> hrs
                </div>
            </div>
            <div class="duty-card-body">
                <div class="duty-card-row">
                    <span class="duty-card-label"><i class="fas fa-clock"></i> Time In</span>
                    <span class="duty-card-value">${record.timeIn}</span>
                </div>
                <div class="duty-card-row">
                    <span class="duty-card-label"><i class="fas fa-clock"></i> Time Out</span>
                    <span class="duty-card-value">${record.timeOut}</span>
                </div>
                <div class="duty-card-row">
                    <span class="duty-card-label"><i class="fas fa-dollar-sign"></i> Rate</span>
                    <span class="duty-card-value">${record.compensationType || 'Regular Rate'}</span>
                </div>
                <div class="duty-card-row">
                    <span class="duty-card-label"><i class="fas fa-calendar-day"></i> Day Type</span>
                    <span class="duty-card-value">${record.dayType || 'Regular'}</span>
                </div>
                <div class="duty-card-row">
                    <span class="duty-card-label"><i class="fas fa-plus-circle"></i> Overtime</span>
                    <span class="duty-card-value">${record.overTime ? record.overTime + ' hrs' : 'None'}</span>
                </div>
            </div>
            <div class="duty-card-footer">
                <button class="action-btn edit-btn" onclick="editDutyRecord('${record.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn delete-btn" onclick="deleteDutyRecord('${record.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        cardsWrapper.appendChild(card);
    });
}

// --- Render Summary ---
function renderSummary(records) {
    const totalHours = records.reduce((sum, record) => sum + record.hours, 0);
    const totalOvertime = records.reduce((sum, record) => sum + (parseFloat(record.overTime) || 0), 0);
    const totalRecords = records.length;

    // Desktop Summary (Footer)
    const tfoot = document.getElementById('dutyTableFoot');
    if (tfoot) {
        tfoot.innerHTML = `
            <tr class="summary-row">
                <td colspan="3"><strong>Total</strong></td>
                <td><strong>${totalHours.toFixed(2)} hrs</strong></td>
                <td colspan="2"><strong>${totalRecords} record(s)</strong></td>
                <td><strong>${totalOvertime.toFixed(2)} hrs</strong></td>
                <td></td>
            </tr>
        `;
    }

    // Mobile Summary
    const summaryMobile = document.getElementById('dutySummaryMobile');
    if (summaryMobile) {
        summaryMobile.innerHTML = `
            <div class="summary-item">
                <span class="summary-label">Total Records</span>
                <span class="summary-value">${totalRecords}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Total Hours</span>
                <span class="summary-value">${totalHours.toFixed(2)} hrs</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Total Overtime</span>
                <span class="summary-value">${totalOvertime.toFixed(2)} hrs</span>
            </div>
        `;
    }
}

// --- Edit Duty Record ---
window.editDutyRecord = function(recordId) {
    const record = dutyLogRecords.find(r => r.id === recordId);
    if (!record) {
        console.error("Record not found:", recordId);
        return;
    }

    // Open custom edit modal
    openEditModal(record);
};

// --- Delete Duty Record ---
window.deleteDutyRecord = function(recordId) {
    // Show custom delete confirmation
    showDutyLogDeleteConfirmation(recordId);
};

// --- Edit Modal Functions ---
function openEditModal(record) {
    const modal = document.getElementById('dutyLogEditModal');
    if (!modal) return;

    // Clear any previous errors
    clearEditError();

    // Populate form fields
    document.getElementById('editDutyId').value = record.id;
    document.getElementById('editDutyDate').value = record.date;
    document.getElementById('editDutyTimeIn').value = record.timeIn;
    document.getElementById('editDutyTimeOut').value = record.timeOut;
    document.getElementById('editDutyRate').value = record.compensationType || 'Regular Rate';
    document.getElementById('editDutyDayType').value = record.dayType || 'Regular';
    document.getElementById('editDutyOvertime').value = record.overTime || '0';

    modal.classList.add('active');
}

function closeEditModal() {
    const modal = document.getElementById('dutyLogEditModal');
    if (modal) {
        modal.classList.remove('active');
        clearEditError();
    }
}

function clearEditError() {
    const errorEl = document.getElementById('editDutyError');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
}

function showEditError(message) {
    const errorEl = document.getElementById('editDutyError');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

async function saveEditedDuty() {
    clearEditError();

    const id = document.getElementById('editDutyId').value;
    const date = document.getElementById('editDutyDate').value;
    const timeIn = document.getElementById('editDutyTimeIn').value;
    const timeOut = document.getElementById('editDutyTimeOut').value;
    const rate = document.getElementById('editDutyRate').value;
    const dayType = document.getElementById('editDutyDayType').value;
    const overTime = document.getElementById('editDutyOvertime').value || '0';

    // Basic validation
    if (!date || !timeIn || !timeOut) {
        showEditError('Date, Time In, and Time Out are required');
        return;
    }

    const hours = calculateDutyHours(timeIn, timeOut);

    if (hours < 0.5) {
        showEditError('Shift must be at least 30 minutes');
        return;
    }

    if (hours > 24) {
        showEditError('Shift cannot exceed 24 hours');
        return;
    }

    try {
        const duty = {
            date,
            timeIn,
            timeOut,
            compensationType: rate,
            overTime: parseFloat(overTime) || 0,
            dayType,
            hours,
            user: auth.currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("duties").doc(id).update(duty);
        console.log("Duty updated successfully from View Duty Log");

        closeEditModal();
        await loadDutyLogRecords();
        renderDutyLog();

        // Also refresh input duty page if loaded
        if (typeof loadDutyRecords === 'function') {
            await loadDutyRecords();
            if (typeof renderCalendar === 'function') renderCalendar();
            if (typeof renderGraph === 'function') renderGraph();
        }

    } catch (error) {
        console.error("Update error:", error);
        showEditError("Failed to update duty. Please try again.");
    }
}

// --- Delete Confirmation Functions ---
function showDutyLogDeleteConfirmation(recordId) {
    const modal = document.getElementById('dutyLogDeleteModal');
    if (!modal) return;

    modal.classList.add('active');

    const confirmBtn = document.getElementById('confirmDutyLogDelete');
    const cancelBtn = document.getElementById('cancelDutyLogDelete');

    const handleConfirm = async () => {
        await performDutyLogDelete(recordId);
        cleanup();
    };

    const handleCancel = () => {
        closeDutyLogDeleteModal();
        cleanup();
    };

    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
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

async function performDutyLogDelete(recordId) {
    try {
        await db.collection("duties").doc(recordId).delete();
        console.log("Duty record deleted successfully from View Duty Log");
        
        closeDutyLogDeleteModal();

        // Reload records and re-render
        await loadDutyLogRecords();
        renderDutyLog();

        // Also reload calendar data if loaded
        if (typeof loadDutyRecords === 'function') {
            await loadDutyRecords();
            if (typeof renderCalendar === 'function') renderCalendar();
            if (typeof renderGraph === 'function') renderGraph();
        }

    } catch (error) {
        console.error("Delete error:", error);
        alert("Failed to delete duty record. Please try again.");
    }
}