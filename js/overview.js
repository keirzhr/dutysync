console.log("🏠 overview.js loaded - FIXED VERSION");

// --- Global Variables ---
let overviewDuties = [];
let overviewPayslips = [];
let userSettings = null;
let last7DaysChartInstance = null;
let deductionMiniChartInstance = null;
let unsubscribeDutiesOverview = null;
let unsubscribePayslipsOverview = null;
let unsubscribeSettingsOverview = null;

// --- Initialize on Auth Change ---
auth.onAuthStateChanged(user => {
    if (user) {
        setupRealtimeListeners(user.uid);
    } else {
        if (unsubscribeDutiesOverview) unsubscribeDutiesOverview();
        if (unsubscribePayslipsOverview) unsubscribePayslipsOverview();
        if (unsubscribeSettingsOverview) unsubscribeSettingsOverview();
    }
});

// --- Setup Real-time Firestore Listeners ---
function setupRealtimeListeners(userId) {
    console.log(`🔄 Setting up overview real-time listeners for: ${userId}`);

    // Duties Listener
    if (unsubscribeDutiesOverview) unsubscribeDutiesOverview();
    unsubscribeDutiesOverview = db.collection("duties")
        .where("user", "==", userId)
        .onSnapshot(snapshot => {
            overviewDuties = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log("✅ Overview duties updated:", overviewDuties.length);
            renderOverviewUI();
        }, error => {
            console.error("❌ Duties listener error:", error);
            showOverviewEmptyState();
        });

    // Payslips Listener
    if (unsubscribePayslipsOverview) unsubscribePayslipsOverview();
    unsubscribePayslipsOverview = db.collection('payslip_history')
        .doc(userId)
        .collection('records')
        .onSnapshot(snapshot => {
            overviewPayslips = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log("✅ Overview payslips updated:", overviewPayslips.length);
            renderOverviewUI();
        }, error => {
            console.error("❌ Payslips listener error:", error);
        });

    // Settings Listener (for rates)
    if (unsubscribeSettingsOverview) unsubscribeSettingsOverview();
    unsubscribeSettingsOverview = db.collection('users')
        .doc(userId)
        .onSnapshot(doc => {
            if (doc.exists) {
                userSettings = doc.data();
                console.log("✅ User settings loaded for overview");
                renderOverviewUI();
            }
        }, error => {
            console.error("❌ Settings listener error:", error);
        });
}

// --- Calculate Current Period Estimated Earnings (ACCURATE) ---
function calculateCurrentPeriodEstimate() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Determine current cutoff
    let cutoff = currentDay <= 15 ? 1 : 2;
    let startDay = cutoff === 1 ? 1 : 16;
    let endDay = cutoff === 1 ? 15 : new Date(currentYear, currentMonth, 0).getDate();

    // Filter duties for current pay period
    const currentPeriodDuties = overviewDuties.filter(duty => {
        const [y, m, d] = duty.date.split("-").map(Number);
        return y === currentYear && m === currentMonth && d >= startDay && d <= endDay;
    });

    if (currentPeriodDuties.length === 0) {
        return {
            grossPay: 0,
            netPay: 0,
            totalDeductions: 0,
            cutoffLabel: `${getMonthNameShort(currentMonth)} ${cutoff === 1 ? '1-15' : '16-30'}`,
            basicPay: 0,
            overtimePay: 0,
            nightDiffPay: 0,
            holidayPay: 0
        };
    }

    // Get user rates with proper fallbacks
    const hourlyRate = parseFloat(userSettings?.hourlyRate) || 0;
    const overtimeMultiplier = parseFloat(userSettings?.overtimeMultiplier) || 1.25;
    const nightDiffMultiplier = parseFloat(userSettings?.nightDiffMultiplier) || 0.10;

    // Calculate earnings using SAME LOGIC as generate.js
    let regularHoursPayable = 0;
    let overtimeHoursPayable = 0;
    let holidayPayAccumulator = 0;
    let nightDiffHours = 0;

    currentPeriodDuties.forEach(duty => {
        const regular = parseFloat(duty.regularHours) || 0;
        const night = parseFloat(duty.nightHours) || 0;
        const overtime = parseFloat(duty.overtimeHours) || 0;
        const totalDuration = regular + night;
        const dayType = duty.dayType || 'Regular';

        const isHoliday = dayType.includes('Holiday') || dayType.includes('Special');

        nightDiffHours += night;

        if (isHoliday) {
            let multiplier = 1.0;
            if (dayType.includes('130')) multiplier = 1.30;
            if (dayType.includes('200')) multiplier = 2.00;

            const holidayBaseHours = Math.max(0, totalDuration - overtime);
            const holidayOTHours = overtime;

            holidayPayAccumulator += holidayBaseHours * multiplier;
            
            if (holidayOTHours > 0) {
                holidayPayAccumulator += holidayOTHours * (multiplier * 1.3);
            }
        } else {
            const basic = Math.max(0, totalDuration - overtime);
            regularHoursPayable += basic;
            overtimeHoursPayable += overtime;
        }
    });

    // Calculate pay components
    const basicPay = roundToDecimal(regularHoursPayable * hourlyRate, 2);
    const overtimePay = roundToDecimal(overtimeHoursPayable * hourlyRate * overtimeMultiplier, 2);
    const nightDiffPay = roundToDecimal(nightDiffHours * hourlyRate * nightDiffMultiplier, 2);
    const holidayPay = roundToDecimal(holidayPayAccumulator * hourlyRate, 2);

    const grossPay = roundToDecimal(basicPay + overtimePay + nightDiffPay + holidayPay, 2);

    // Calculate deductions
    const deductions = calculateEstimatedDeductions(grossPay);
    const netPay = roundToDecimal(grossPay - deductions.total, 2);

    return {
        grossPay,
        netPay,
        totalDeductions: deductions.total,
        cutoffLabel: `${getMonthNameShort(currentMonth)} ${cutoff === 1 ? '1-15' : '16-30'}`,
        basicPay,
        overtimePay,
        nightDiffPay,
        holidayPay,
        ...deductions
    };
}

// --- Round to Decimal Helper ---
function roundToDecimal(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

// --- Calculate Estimated Deductions (ACCURATE) ---
function calculateEstimatedDeductions(grossPay) {
    // SSS 2025
    const sssContribution = calculateSSS(grossPay * 2) / 2; // Convert to semi-monthly
    
    // PhilHealth 2025
    const philhealthContribution = calculatePhilHealth(grossPay * 2);
    
    // Pag-IBIG 2025
    const pagibigContribution = calculatePagibig(grossPay * 2) / 2;
    
    // BIR Tax
    const taxableIncome = roundToDecimal(grossPay - (sssContribution + philhealthContribution + pagibigContribution), 2);
    const birTax = calculateBIRWithholdingTax(taxableIncome);

    const total = roundToDecimal(sssContribution + philhealthContribution + pagibigContribution + birTax, 2);

    return {
        sss: sssContribution,
        philhealth: philhealthContribution,
        pagibig: pagibigContribution,
        birTax: birTax,
        total: total
    };
}

// --- SSS 2025 ---
function calculateSSS(monthlyGross) {
    const brackets = [
        [4249.99, 180], [4749.99, 202.50], [5249.99, 225], [5749.99, 247.50],
        [6249.99, 270], [6749.99, 292.50], [7249.99, 315], [7749.99, 337.50],
        [8249.99, 360], [8749.99, 382.50], [9249.99, 405], [9749.99, 427.50],
        [10249.99, 450], [10749.99, 472.50], [11249.99, 495], [11749.99, 517.50],
        [12249.99, 540], [12749.99, 562.50], [13249.99, 585], [13749.99, 607.50],
        [14249.99, 630], [14749.99, 652.50], [15249.99, 675], [15749.99, 697.50],
        [16249.99, 720], [16749.99, 742.50], [17249.99, 765], [17749.99, 787.50],
        [18249.99, 810], [18749.99, 832.50], [19249.99, 855], [19749.99, 877.50],
        [20249.99, 900], [20749.99, 922.50], [21249.99, 945], [21749.99, 967.50],
        [22249.99, 990], [22749.99, 1012.50], [23249.99, 1035], [23749.99, 1057.50],
        [24249.99, 1080], [24749.99, 1102.50], [25249.99, 1125], [25749.99, 1147.50],
        [26249.99, 1170], [26749.99, 1192.50], [27249.99, 1215], [27749.99, 1237.50],
        [28249.99, 1260], [28749.99, 1282.50], [29249.99, 1305], [29749.99, 1327.50]
    ];
    
    for (const [max, ee] of brackets) {
        if (monthlyGross <= max) return ee;
    }
    return 1350;
}

// --- PhilHealth 2025 ---
function calculatePhilHealth(monthlyGross) {
    const rate = 0.05;
    const minBasis = 10000;
    const maxBasis = 100000;
    const basis = Math.max(minBasis, Math.min(maxBasis, monthlyGross));
    return roundToDecimal((basis * rate) / 2, 2);
}

// --- Pag-IBIG 2025 ---
function calculatePagibig(monthlyGross) {
    if (monthlyGross <= 1500) return roundToDecimal(monthlyGross * 0.01, 2);
    return Math.min(roundToDecimal(monthlyGross * 0.02, 2), 200);
}

// --- BIR Withholding Tax (Semi-Monthly) ---
function calculateBIRWithholdingTax(taxableIncomeSemiMonthly) {
    const semiMonthlyTable = [
        { maxIncome: 10416.50, fixed: 0, percent: 0, compensationLevel: 0 },
        { maxIncome: 16666.50, fixed: 0, percent: 15, compensationLevel: 10416.50 },
        { maxIncome: 33332.50, fixed: 1250.00, percent: 20, compensationLevel: 16666.50 },
        { maxIncome: 83332.50, fixed: 5416.67, percent: 25, compensationLevel: 33332.50 },
        { maxIncome: 333332.50, fixed: 20416.67, percent: 30, compensationLevel: 83332.50 },
        { maxIncome: Infinity, fixed: 100416.67, percent: 35, compensationLevel: 333332.50 }
    ];

    for (const bracket of semiMonthlyTable) {
        if (taxableIncomeSemiMonthly <= bracket.maxIncome) {
            if (bracket.percent === 0) return 0;
            const excess = taxableIncomeSemiMonthly - bracket.compensationLevel;
            const tax = bracket.fixed + (excess * (bracket.percent / 100));
            return roundToDecimal(tax, 2);
        }
    }
    
    return 0;
}

// --- Main Render Function ---
function renderOverviewUI() {
    console.log("📊 Rendering Overview UI");

    if (overviewDuties.length === 0 && overviewPayslips.length === 0) {
        showOverviewEmptyState();
        return;
    }

    hideOverviewEmptyState();

    updateHeroStats();
    updateAlerts();
    updateLast7DaysChart();
    updateDeductionMiniChart();
    updateRecentLogs();
}

// --- Update Hero Stats ---
function updateHeroStats() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // This Month Hours
    const thisMonthDuties = overviewDuties.filter(duty => {
        const [y, m] = duty.date.split("-").map(Number);
        return y === currentYear && m === currentMonth;
    });

    const thisMonthHours = thisMonthDuties.reduce((sum, d) => sum + (parseFloat(d.totalHours) || 0), 0);
    setText('heroThisMonthHours', thisMonthHours.toFixed(2));

    // Calculate hours change vs previous month
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevMonthDuties = overviewDuties.filter(duty => {
        const [y, m] = duty.date.split("-").map(Number);
        return y === prevYear && m === prevMonth;
    });
    const prevMonthHours = prevMonthDuties.reduce((sum, d) => sum + (parseFloat(d.totalHours) || 0), 0);
    const hoursChange = prevMonthHours > 0 ? ((thisMonthHours - prevMonthHours) / prevMonthHours * 100).toFixed(1) : 0;
    const hoursChangeEl = document.getElementById('hoursChange');
    // Assuming the parent element or the element itself is the badge container
    // You might need to target the parent if 'hoursChange' is just the span inside the badge
    const badgeContainer = hoursChangeEl.parentElement; // Adjust selector as needed

    if (hoursChangeEl) {
        // Remove old classes
        hoursChangeEl.classList.remove('increase', 'decrease', 'neutral');
        
        if (hoursChange > 0) {
            hoursChangeEl.classList.add('increase');
            hoursChangeEl.innerHTML = `<i class="fas fa-arrow-up"></i> +${hoursChange}%`;
        } else if (hoursChange < 0) {
            hoursChangeEl.classList.add('decrease');
            hoursChangeEl.innerHTML = `<i class="fas fa-arrow-down"></i> ${hoursChange}%`;
        } else {
            hoursChangeEl.classList.add('neutral');
            hoursChangeEl.innerHTML = `<i class="fas fa-minus"></i> ${hoursChange}%`;
        }
    }
    // Current Net Pay (Estimated for current period)
    const currentEstimate = calculateCurrentPeriodEstimate();
    setText('heroCurrentNetPay', formatCurrency(currentEstimate.netPay));

    // Calculate change vs previous payslip
    if (overviewPayslips.length > 0) {
        const sortedPayslips = [...overviewPayslips].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            if (a.month !== b.month) return b.month - a.month;
            return b.cutoff - a.cutoff;
        });

        const latestPayslip = sortedPayslips[0];
        const netPayChange = latestPayslip.netPay > 0 
            ? ((currentEstimate.netPay - latestPayslip.netPay) / latestPayslip.netPay * 100).toFixed(1)
            : 0;
        
        const netPayChangeEl = document.getElementById('netPayChange');
        if (netPayChangeEl) {
            netPayChangeEl.textContent = netPayChange >= 0 ? `+${netPayChange}%` : `${netPayChange}%`;
            netPayChangeEl.style.color = netPayChange >= 0 ? '#10b981' : '#ef4444';
        }

        // Last Payslip (from history)
        setText('heroLastPayslip', formatCurrency(latestPayslip.netPay || 0));
        const dateStr = `${getMonthNameShort(latestPayslip.month)} ${latestPayslip.cutoff === 1 ? '1-15' : '16-30'}`;
        setText('lastPayslipDate', dateStr);
    } else {
        setText('heroLastPayslip', '₱0.00');
        setText('lastPayslipDate', 'No record');
        const netPayChangeEl = document.getElementById('netPayChange');
        if (netPayChangeEl) {
            netPayChangeEl.textContent = '0%';
        }
    }

    // YTD Earnings (from actual payslips)
    const ytdPayslips = overviewPayslips.filter(p => p.year === currentYear);
    const ytdTotal = ytdPayslips.reduce((sum, p) => sum + (parseFloat(p.netPay) || 0), 0);
    setText('heroYTDEarnings', formatCurrency(ytdTotal));
    setText('ytdCount', `${ytdPayslips.length} ${ytdPayslips.length === 1 ? 'period' : 'periods'}`);
}



// --- Update Alerts ---
function updateAlerts() {
    const alertsContainer = document.getElementById('alertsContainer');
    if (!alertsContainer) return;

    const now = new Date();
    const day = now.getDate();
    const payslipAlert = document.getElementById('payslipAlert');

    let daysUntilCutoff = 0;
    let nextCutoffType = '';

    if (day <= 10) {
        daysUntilCutoff = 15 - day;
        nextCutoffType = 'Mid-month (15th)';
    } else if (day <= 27) {
        daysUntilCutoff = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - day;
        nextCutoffType = 'Month-end';
    } else {
        daysUntilCutoff = 15 - (day - new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
        nextCutoffType = 'Mid-month (15th)';
    }

    if (daysUntilCutoff <= 3 && daysUntilCutoff > 0) {
        setText('alertMessage', `Cutoff in ${daysUntilCutoff} ${daysUntilCutoff === 1 ? 'day' : 'days'} (${nextCutoffType}) - Ready to generate?`);
        payslipAlert.style.display = 'flex';
    } else {
        payslipAlert.style.display = 'none';
    }

    const streakAlert = document.getElementById('streakAlert');
    const workStreak = calculateWorkStreak();

    if (workStreak > 0) {
        setText('streakMessage', `🔥 ${workStreak} ${workStreak === 1 ? 'Day' : 'Days'} Worked This Week!`);
        streakAlert.style.display = 'flex';
    } else {
        streakAlert.style.display = 'none';
    }
}

// --- Calculate Work Streak ---
function calculateWorkStreak() {
    const now = new Date();
    let streak = 0;

    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];

        const hasWork = overviewDuties.some(d => d.date === dateStr);
        if (hasWork) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }

    return streak;
}

// --- Update Last 7 Days Chart ---
function updateLast7DaysChart() {
    const ctx = document.getElementById('last7DaysChart');
    if (!ctx) return;

    const { dates, hours } = renderLast7DaysChartData();
    const totalHours = hours.reduce((a, b) => a + b, 0);
    const avgHours = hours.length > 0 ? (totalHours / hours.length).toFixed(2) : 0;

    setText('last7Total', totalHours.toFixed(2) + ' hrs');
    setText('last7Avg', avgHours + ' hrs');

    if (last7DaysChartInstance) last7DaysChartInstance.destroy();

    last7DaysChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Hours Worked',
                data: hours,
                backgroundColor: hours.map((_, i) => 
                    `rgba(59, 130, 246, ${0.5 + (i * 0.05)})`
                ),
                borderColor: '#3b82f6',
                borderWidth: 2,
                borderRadius: 8,
                hoverBackgroundColor: 'rgba(59, 130, 246, 0.9)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => `${ctx.parsed.y.toFixed(2)} hrs`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'var(--text-secondary)',
                        font: { size: 11 }
                    }
                },
                x: { 
                    grid: { display: false },
                    ticks: {
                        color: 'var(--text-secondary)',
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function renderLast7DaysChartData() {
    const now = new Date();
    const dates = [];
    const hours = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dates.push(formatDateShort(dateStr));

        const dayDuties = overviewDuties.filter(d => d.date === dateStr);
        const dayHours = dayDuties.reduce((sum, d) => sum + (parseFloat(d.totalHours) || 0), 0);
        hours.push(dayHours);
    }

    return { dates, hours };
}

// --- Update Deduction Mini Chart ---
function updateDeductionMiniChart() {
    const currentEstimate = calculateCurrentPeriodEstimate();

    setText('miniGrossPay', formatCurrency(currentEstimate.grossPay));
    setText('miniTotalDeductions', formatCurrency(currentEstimate.totalDeductions));
    setText('miniNetPay', formatCurrency(currentEstimate.netPay));

    const ctx = document.getElementById('deductionMiniChart');
    if (!ctx) return;

    const deductionTypes = [
        { name: 'SSS', value: currentEstimate.sss || 0 },
        { name: 'PhilHealth', value: currentEstimate.philhealth || 0 },
        { name: 'Pag-IBIG', value: currentEstimate.pagibig || 0 },
        { name: 'BIR Tax', value: currentEstimate.birTax || 0 }
    ];

    if (deductionMiniChartInstance) deductionMiniChartInstance.destroy();

    deductionMiniChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: deductionTypes.map(d => d.name),
            datasets: [{
                data: deductionTypes.map(d => d.value),
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: 'var(--card-bg)',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 11 },
                        padding: 12,
                        usePointStyle: true,
                        color: 'var(--text-primary)'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => `₱${ctx.parsed.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    }
                }
            }
        }
    });
}

// --- Update Recent Logs ---
function updateRecentLogs() {
    const container = document.getElementById('recentLogsContainer');
    if (!container) return;

    if (overviewDuties.length === 0) {
        container.innerHTML = `
            <div class="recent-empty">
                <i class="fas fa-inbox"></i>
                <p>No duty records yet</p>
            </div>
        `;
        return;
    }

    const recentDuties = [...overviewDuties]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);

    container.innerHTML = recentDuties.map(duty => `
        <div class="recent-log-item">
            <div>
                <div class="recent-log-date">${formatDateLong(duty.date)}</div>
                <div class="recent-log-hours">${(parseFloat(duty.totalHours) || 0).toFixed(2)} hrs</div>
            </div>
            <div class="recent-log-time">${duty.timeIn} - ${duty.timeOut}</div>
        </div>
    `).join('');
}
function updateYearToDateEarnings() {
    const currentYear = new Date().getFullYear();
    
    // Filter payslips for this year only
    const thisYearPayslips = overviewPayslips.filter(p => {
        // Assuming your payslip ID or data contains the year, or 'dateGenerated' field
        // Adjust 'p.year' based on how you save it in generate.js
        return parseInt(p.year) === currentYear; 
    });

    // Sum Earnings
    const totalGross = thisYearPayslips.reduce((sum, p) => sum + (parseFloat(p.grossPay) || 0), 0);
    const totalNet = thisYearPayslips.reduce((sum, p) => sum + (parseFloat(p.netPay) || 0), 0);

    // Update UI
    const elTotalGross = document.getElementById('totalEarningsGross');
    const elTotalNet = document.getElementById('totalEarningsNet');

    if (elTotalGross) elTotalGross.textContent = `₱${totalGross.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    if (elTotalNet) elTotalNet.textContent = `₱${totalNet.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    
    console.log(`📊 YTD Updated: Gross ₱${totalGross}, Net ₱${totalNet}`);
}

// *** IMPORTANT: Call this function inside your existing snapshot listener ***
/* unsubscribePayslipsOverview = db.collection('payslip_history')...onSnapshot(snapshot => {
    overviewPayslips = ...;
    updateYearToDateEarnings(); // <--- ADD THIS CALL
    renderOverviewUI();
});
*/

// --- Helper Functions ---
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatCurrency(amount) {
    return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateShort(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMonthNameShort(month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
}

function showOverviewEmptyState() {
    const el = document.getElementById('overviewEmptyState');
    if (el) el.style.display = 'flex';

    const heroStats = document.querySelector('.hero-stats-grid');
    if (heroStats) heroStats.style.display = 'none';

    const alerts = document.getElementById('alertsContainer');
    if (alerts) alerts.style.display = 'none';

    const insights = document.querySelector('.visual-insights-grid');
    if (insights) insights.style.display = 'none';

    const actions = document.querySelector('.action-activity-grid');
    if (actions) actions.style.display = 'none';
}

function hideOverviewEmptyState() {
    const el = document.getElementById('overviewEmptyState');
    if (el) el.style.display = 'none';

    const heroStats = document.querySelector('.hero-stats-grid');
    if (heroStats) heroStats.style.display = 'grid';

    const alerts = document.getElementById('alertsContainer');
    if (alerts) alerts.style.display = 'grid';

    const insights = document.querySelector('.visual-insights-grid');
    if (insights) insights.style.display = 'grid';

    const actions = document.querySelector('.action-activity-grid');
    if (actions) actions.style.display = 'grid';
}

// --- Cleanup ---
window.addEventListener('beforeunload', () => {
    if (unsubscribeDutiesOverview) unsubscribeDutiesOverview();
    if (unsubscribePayslipsOverview) unsubscribePayslipsOverview();
    if (unsubscribeSettingsOverview) unsubscribeSettingsOverview();
});