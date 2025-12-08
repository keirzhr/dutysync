let dutyLogRecords = [];
let unsubscribeDutyLog = null;
let selectedMonth = null;

function initializeMonthFilter() {
    const monthFilterInput = document.getElementById('monthFilter');
    if (!monthFilterInput) return;

    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    monthFilterInput.value = currentMonth;
    selectedMonth = currentMonth;
}

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

const monthFilterInput = document.getElementById('monthFilter');
if (monthFilterInput) {
    monthFilterInput.addEventListener('change', (e) => {
        selectedMonth = e.target.value;
        renderDutyLog();
    });
}

function setupRealtimeDutyListener(userId) {
    if (unsubscribeDutyLog) unsubscribeDutyLog();

    unsubscribeDutyLog = db.collection("duties")
        .where("user", "==", userId)
        .onSnapshot(snapshot => {
            dutyLogRecords = snapshot.docs.map(doc => {
                const data = { id: doc.id, ...doc.data() };
                return data;
            });
            renderDutyLog();
        });
}

function filterRecordsByMonth(records) {
    if (!selectedMonth) {
        const today = new Date();
        selectedMonth = today.toISOString().slice(0, 7);
    }
    return records.filter(record => record.date && record.date.slice(0, 7) === selectedMonth);
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function renderDutyLog() {
    const filteredRecords = filterRecordsByMonth(dutyLogRecords);
    const sortedRecords = [...filteredRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('dutyTableBody');
    if (tbody) {
        if (sortedRecords.length === 0) {
            renderEmptyTableState(tbody);
        } else {
            renderDesktopTable(tbody, sortedRecords);
        }
    }

    renderMiniDashboard(sortedRecords);
    renderMobileCards(sortedRecords);
}

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

function renderDesktopTable(tbody, records) {
    tbody.innerHTML = '';
    records.forEach(record => {
        const totalHours = record.totalHours || record.hours || 0;
        const nightHours = record.nightHours || 0;
        const overtimeHours = record.overtimeHours || record.overTime || 0;

        const row = document.createElement('tr');
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

function renderMiniDashboard(records) {
    let totalHours = 0;
    let basicHours = 0;
    let nightHours = 0;
    let specialDayHours = 0;
    let overTimeHours = 0;

    records.forEach(record => {
        const total = record.totalHours || record.hours || 0;
        const night = record.nightHours || 0;
        const overtime = record.overtimeHours || record.overTime || 0;
        const dayType = record.dayType || 'Regular';
        const basic = Math.max(0, total - overtime);

        totalHours += total;
        basicHours += basic;
        nightHours += night;
        overTimeHours += overtime;

        if (dayType.includes('Holiday') || dayType.includes('Special')) {
            specialDayHours += total;
        }
    });

    const expectedHours = 22 * 8;
    const availability = expectedHours > 0 ? (totalHours / expectedHours) * 100 : 0;

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setText('dashTotalHours', totalHours.toFixed(2));
    setText('dashRegularHours', basicHours.toFixed(2));
    setText('dashNightHours', nightHours.toFixed(2));
    setText('dashSpecialDayHours', specialDayHours.toFixed(2));
    setText('dashOverTimeHours', overTimeHours.toFixed(2));
    setText('dashAvailability', '%' + availability.toFixed(2));
}

window.editDutyRecord = function(id) {
    const record = dutyLogRecords.find(r => r.id === id);
    if (!record) return;
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
    document.getElementById('editDutyTimeIn').value = record.timeIn;
    document.getElementById('editDutyTimeOut').value = record.timeOut;
    document.getElementById('editDutyDayType').value = record.dayType || 'Regular';
    
    updateEditPreview();
    
    const timeInInput = document.getElementById('editDutyTimeIn');
    const timeOutInput = document.getElementById('editDutyTimeOut');
    
    timeInInput.removeEventListener('input', updateEditPreview);
    timeOutInput.removeEventListener('input', updateEditPreview);
    
    // Add fresh event listeners
    timeInInput.addEventListener('input', updateEditPreview);
    timeOutInput.addEventListener('input', updateEditPreview);
    
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
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;
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

    if (!date || !timeIn || !timeOut) {
        showEditError("Date, Time In, and Time Out are required");
        return;
    }
    
    const breakdown = calculateShiftBreakdown(timeIn, timeOut);
    if (breakdown.totalHours < 0.5) {
        showEditError("Shift must be at least 30 minutes");
        return;
    }

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
            showEditError("Delete failed");
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