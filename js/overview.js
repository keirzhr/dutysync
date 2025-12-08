// --- Global Variables ---
let overviewDuties = [];
let overviewPayslips = [];
let userSettings = null;
let last7DaysChartInstance = null;
let deductionMiniChartInstance = null;
let unsubscribeDutiesOverview = null;
let unsubscribePayslipsOverview = null;
let unsubscribeSettingsOverview = null;
let themeObserver = null;
let overviewHolidayData = {
  regularHours: 0,
  regularMultiplier: 1.0,
  overtimeHours: 0,
  overtimeMultiplier: 1.3
};

// --- Initialize on Auth Change ---
auth.onAuthStateChanged(user => {
    if (user) {
        setupRealtimeListeners(user.uid);
        setupThemeObserver();
    } else {
        cleanupListeners();
        cleanupThemeObserver();
    }
});

// --- Setup Theme Observer ---
function setupThemeObserver() {
    if (themeObserver) {
        themeObserver.disconnect();
    }
    
    themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                updateChartColors();
            }
        });
    });
    
    themeObserver.observe(document.documentElement, { 
        attributes: true,
        attributeFilter: ['data-theme']
    });
    
    updateChartColors();
}

function cleanupThemeObserver() {
    if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
    }
}

// --- Update Chart Colors Based on Theme ---
function updateChartColors() {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDarkMode ? '#ffffff' : '#1a1a1a';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const tooltipBg = isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(0, 0, 0, 0.8)';
    
    if (last7DaysChartInstance) {
        last7DaysChartInstance.options.scales.y.ticks.color = textColor;
        last7DaysChartInstance.options.scales.x.ticks.color = textColor;
        last7DaysChartInstance.options.scales.y.grid.color = gridColor;
        last7DaysChartInstance.options.plugins.tooltip.backgroundColor = tooltipBg;
        last7DaysChartInstance.options.plugins.tooltip.titleColor = textColor;
        last7DaysChartInstance.options.plugins.tooltip.bodyColor = textColor;
        last7DaysChartInstance.update('none');
    }
    
    if (deductionMiniChartInstance) {
        deductionMiniChartInstance.options.plugins.legend.labels.color = textColor;
        deductionMiniChartInstance.options.plugins.tooltip.backgroundColor = tooltipBg;
        deductionMiniChartInstance.options.plugins.tooltip.titleColor = textColor;
        deductionMiniChartInstance.options.plugins.tooltip.bodyColor = textColor;
        deductionMiniChartInstance.update('none');
    }
}

// --- Setup Real-time Firestore Listeners ---
function setupRealtimeListeners(userId) {
    if (unsubscribeDutiesOverview) unsubscribeDutiesOverview();
    unsubscribeDutiesOverview = db.collection("duties")
        .where("user", "==", userId)
        .onSnapshot(snapshot => {
            overviewDuties = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderOverviewUI();
        }, error => {
            showOverviewEmptyState();
        });

    if (unsubscribePayslipsOverview) unsubscribePayslipsOverview();
    unsubscribePayslipsOverview = db.collection('payslip_history')
        .doc(userId)
        .collection('records')
        .onSnapshot(snapshot => {
            overviewPayslips = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderOverviewUI();
        });

    if (unsubscribeSettingsOverview) unsubscribeSettingsOverview();
    unsubscribeSettingsOverview = db.collection('users')
        .doc(userId)
        .onSnapshot(doc => {
            if (doc.exists) {
                userSettings = doc.data();
                renderOverviewUI();
            }
        });
}

function cleanupListeners() {
    if (unsubscribeDutiesOverview) unsubscribeDutiesOverview();
    if (unsubscribePayslipsOverview) unsubscribePayslipsOverview();
    if (unsubscribeSettingsOverview) unsubscribeSettingsOverview();
}

// --- Main Render Function ---
function renderOverviewUI() {
    if (overviewDuties.length === 0 && overviewPayslips.length === 0) {
        showOverviewEmptyState();
        return;
    }

    hideOverviewEmptyState();
    updateHeroStats();
    updateLast7DaysChart();
    updateDeductionMiniChart();
    updateRecentLogs();
}

// HERO STATS SECTION

function updateHeroStats() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const thisMonthDuties = overviewDuties.filter(duty => {
        const [y, m] = duty.date.split("-").map(Number);
        return y === currentYear && m === currentMonth;
    });
    const thisMonthHours = thisMonthDuties.reduce((sum, d) => sum + (parseFloat(d.totalHours) || 0), 0);
    setText('heroThisMonthHours', thisMonthHours.toFixed(2));

    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevMonthDuties = overviewDuties.filter(duty => {
        const [y, m] = duty.date.split("-").map(Number);
        return y === prevYear && m === prevMonth;
    });
    const prevMonthHours = prevMonthDuties.reduce((sum, d) => sum + (parseFloat(d.totalHours) || 0), 0);
    const hoursChange = prevMonthHours > 0 ? ((thisMonthHours - prevMonthHours) / prevMonthHours * 100).toFixed(1) : 0;

    const currentEstimate = calculateCurrentPeriodEstimate();
    setText('heroCurrentNetPay', formatCurrency(currentEstimate.netPay));

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

        setText('heroLastPayslip', formatCurrency(latestPayslip.netPay || 0));
        const dateStr = `${getMonthNameShort(latestPayslip.month)} ${latestPayslip.cutoff === 1 ? '1-15' : '16-30'}`;
        setText('lastPayslipDate', dateStr);
    } else {
        setText('heroLastPayslip', '₱0.00');
        setText('lastPayslipDate', 'No record');
    }

    const ytdPayslips = overviewPayslips.filter(p => p.year === currentYear);
    const ytdTotal = ytdPayslips.reduce((sum, p) => sum + (parseFloat(p.netPay) || 0), 0);
    setText('heroYTDEarnings', formatCurrency(ytdTotal));
    setText('ytdCount', `${ytdPayslips.length} ${ytdPayslips.length === 1 ? 'period' : 'periods'}`);
}

// LAST 7 DAYS CHART

function updateLast7DaysChart() {
    const ctx = document.getElementById('last7DaysChart');
    if (!ctx) return;

    const { dates, hours } = getLast7DaysData();
    const totalHours = hours.reduce((a, b) => a + b, 0);
    const avgHours = hours.length > 0 ? (totalHours / hours.length).toFixed(2) : 0;

    setText('last7Total', totalHours.toFixed(2) + ' hrs');
    setText('last7Avg', avgHours + ' hrs');

    if (last7DaysChartInstance) last7DaysChartInstance.destroy();

    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDarkMode ? '#ffffff' : '#1a1a1a';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const tooltipBg = isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(0, 0, 0, 0.8)';

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
                legend: { 
                    display: false,
                    labels: {
                        color: textColor
                    }
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: textColor,
                    bodyColor: textColor,
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
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        font: { size: 11 }
                    }
                },
                x: { 
                    grid: { 
                        display: false 
                    },
                    ticks: {
                        color: textColor,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function getLast7DaysData() {
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

// DEDUCTION MINI CHART

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

    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDarkMode ? '#ffffff' : '#1a1a1a';
    const tooltipBg = isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(0, 0, 0, 0.8)';

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
                        color: textColor
                    }
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: textColor,
                    bodyColor: textColor,
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

// RECENT DUTY LOGS

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
            <div class="log-info">
                <div class="recent-log-date">${formatDateLong(duty.date)}</div>
                <div class="recent-log-hours">${(parseFloat(duty.totalHours) || 0).toFixed(2)} hrs</div>
            </div>
            <div class="recent-log-time">${duty.timeIn} - ${duty.timeOut}</div>
        </div>
    `).join('');
}

// CURRENT PERIOD CALCULATION

function calculateCurrentPeriodEstimate() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    let cutoff = currentDay <= 15 ? 1 : 2;
    let startDay = cutoff === 1 ? 1 : 16;
    let endDay = cutoff === 1 ? 15 : new Date(currentYear, currentMonth, 0).getDate();

    const currentPeriodDuties = overviewDuties.filter(duty => {
        const [y, m, d] = duty.date.split("-").map(Number);
        return y === currentYear && m === currentMonth && d >= startDay && d <= endDay;
    });

    if (currentPeriodDuties.length === 0) {
        return {
            grossPay: 0, netPay: 0, totalDeductions: 0,
            sss: 0, philhealth: 0, pagibig: 0, birTax: 0,
            cutoffLabel: `${getMonthNameShort(currentMonth)} ${cutoff === 1 ? '1-15' : '16-30'}`
        };
    }

    const hourlyRate = parseFloat(userSettings?.hourlyRate) || 0;
    const overtimeMultiplier = parseFloat(userSettings?.overtimeMultiplier) || 1.25;
    const nightDiffMultiplier = parseFloat(userSettings?.nightDiffMultiplier) || 0.10;

    let regularHoursPayable = 0;
    let overtimeHoursPayable = 0;
    let nightDiffHours = 0;

    // Reset holiday data
    overviewHolidayData = {
      regularHours: 0,
      regularMultiplier: 1.0,
      overtimeHours: 0,
      overtimeMultiplier: 1.3
    };

    const holidayMultipliers = {
        'Regular': 1.0,
        'Regular Holiday': 2.0,
        'Special Non-Working Holiday': 1.3
    };

    currentPeriodDuties.forEach(duty => {
        const regular = parseFloat(duty.regularHours) || 0;
        const night = parseFloat(duty.nightHours) || 0;
        const overtime = parseFloat(duty.overtimeHours) || 0;
        const totalDuration = regular + night;
        const dayType = duty.dayType || 'Regular';
        const isHoliday = dayType.includes('Holiday') || dayType.includes('Special');

        // Define a proper mapping - parse multiplier from dayType string
        let multiplier = 1.0;
        if (dayType.includes('(200%)')) {
            multiplier = 2.0;
        } else if (dayType.includes('(130%)')) {
            multiplier = 1.3;
        } else if (dayType.includes('Holiday')) {
            multiplier = 2.0; // default to 200% if no percentage specified
        }

        nightDiffHours += night;

        if (isHoliday) {
            const multiplier = holidayMultipliers[dayType] || 1.0;
            const holidayBaseHours = Math.max(0, totalDuration - overtime);
            const holidayOTHours = overtime;

            // Store actual hours with their multipliers
            overviewHolidayData.regularHours += holidayBaseHours;
            overviewHolidayData.regularMultiplier = multiplier;
            overviewHolidayData.overtimeHours += holidayOTHours;
            overviewHolidayData.overtimeMultiplier = multiplier * 1.3;
        } else {
            const basic = Math.max(0, totalDuration - overtime);
            regularHoursPayable += basic;
            overtimeHoursPayable += overtime;
        }
    });

    const basicPay = roundToDecimal(regularHoursPayable * hourlyRate, 2);
    const overtimePay = roundToDecimal(overtimeHoursPayable * hourlyRate * overtimeMultiplier, 2);
    const nightDiffPay = roundToDecimal(nightDiffHours * hourlyRate * nightDiffMultiplier, 2);
    
    // FIXED: Apply holiday multipliers correctly
    const holidayBasePay = roundToDecimal(overviewHolidayData.regularHours * hourlyRate * overviewHolidayData.regularMultiplier, 2);
    const holidayOTPay = roundToDecimal(overviewHolidayData.overtimeHours * hourlyRate * overviewHolidayData.overtimeMultiplier, 2);
    const holidayPay = roundToDecimal(holidayBasePay + holidayOTPay, 2);
    
    const grossPay = roundToDecimal(basicPay + overtimePay + nightDiffPay + holidayPay, 2);

    const deductions = calculateEstimatedDeductions(grossPay);
    const netPay = roundToDecimal(grossPay - deductions.total, 2);

    return {
        grossPay, netPay, totalDeductions: deductions.total,
        sss: deductions.sss, philhealth: deductions.philhealth,
        pagibig: deductions.pagibig, birTax: deductions.birTax,
        cutoffLabel: `${getMonthNameShort(currentMonth)} ${cutoff === 1 ? '1-15' : '16-30'}`
    };
}

function calculateEstimatedDeductions(grossPay) {
    const sss = roundToDecimal(calculateSSS(grossPay * 2) / 2, 2);
    const philhealth = roundToDecimal(calculatePhilHealth(grossPay * 2), 2);
    const pagibig = roundToDecimal(calculatePagibig(grossPay * 2) / 2, 2);
    const taxableIncome = roundToDecimal(grossPay - (sss + philhealth + pagibig), 2);
    const birTax = calculateBIRWithholdingTax(taxableIncome);
    const total = roundToDecimal(sss + philhealth + pagibig + birTax, 2);

    return { sss, philhealth, pagibig, birTax, total };
}

function calculateSSS(monthlyGross) {
  const brackets = [
    { min: 0, max: 4249.99, ee: 180.00 },
    { min: 4250, max: 4749.99, ee: 202.50 },
    { min: 4750, max: 5249.99, ee: 225.00 },
    { min: 5250, max: 5749.99, ee: 247.50 },
    { min: 5750, max: 6249.99, ee: 270.00 },
    { min: 6250, max: 6749.99, ee: 292.50 },
    { min: 6750, max: 7249.99, ee: 315.00 },
    { min: 7250, max: 7749.99, ee: 337.50 },
    { min: 7750, max: 8249.99, ee: 360.00 },
    { min: 8250, max: 8749.99, ee: 382.50 },
    { min: 8750, max: 9249.99, ee: 405.00 },
    { min: 9250, max: 9749.99, ee: 427.50 },
    { min: 9750, max: 10249.99, ee: 450.00 },
    { min: 10250, max: 10749.99, ee: 472.50 },
    { min: 10750, max: 11249.99, ee: 495.00 },
    { min: 11250, max: 11749.99, ee: 517.50 },
    { min: 11750, max: 12249.99, ee: 540.00 },
    { min: 12250, max: 12749.99, ee: 562.50 },
    { min: 12750, max: 13249.99, ee: 585.00 },
    { min: 13250, max: 13749.99, ee: 607.50 },
    { min: 13750, max: 14249.99, ee: 630.00 },
    { min: 14250, max: 14749.99, ee: 652.50 },
    { min: 14750, max: 15249.99, ee: 675.00 },
    { min: 15250, max: 15749.99, ee: 697.50 },
    { min: 15750, max: 16249.99, ee: 720.00 },
    { min: 16250, max: 16749.99, ee: 742.50 },
    { min: 16750, max: 17249.99, ee: 765.00 },
    { min: 17250, max: 17749.99, ee: 787.50 },
    { min: 17750, max: 18249.99, ee: 810.00 },
    { min: 18250, max: 18749.99, ee: 832.50 },
    { min: 18750, max: 19249.99, ee: 855.00 },
    { min: 19250, max: 19749.99, ee: 877.50 },
    { min: 19750, max: 20249.99, ee: 900.00 },
    { min: 20250, max: 20749.99, ee: 922.50 },
    { min: 20750, max: 21249.99, ee: 945.00 },
    { min: 21250, max: 21749.99, ee: 967.50 },
    { min: 21750, max: 22249.99, ee: 990.00 },
    { min: 22250, max: 22749.99, ee: 1012.50 },
    { min: 22750, max: 23249.99, ee: 1035.00 },
    { min: 23250, max: 23749.99, ee: 1057.50 },
    { min: 23750, max: 24249.99, ee: 1080.00 },
    { min: 24250, max: 24749.99, ee: 1102.50 },
    { min: 24750, max: 25249.99, ee: 1125.00 },
    { min: 25250, max: 25749.99, ee: 1147.50 },
    { min: 25750, max: 26249.99, ee: 1170.00 },
    { min: 26250, max: 26749.99, ee: 1192.50 },
    { min: 26750, max: 27249.99, ee: 1215.00 },
    { min: 27250, max: 27749.99, ee: 1237.50 },
    { min: 27750, max: 28249.99, ee: 1260.00 },
    { min: 28250, max: 28749.99, ee: 1282.50 },
    { min: 28750, max: 29249.99, ee: 1305.00 },
    { min: 29250, max: 29749.99, ee: 1327.50 },
    { min: 29750, max: Infinity, ee: 1350.00 }
  ];
  
  // Find the bracket where monthlyGross falls
  for (const bracket of brackets) {
    if (monthlyGross >= bracket.min && monthlyGross <= bracket.max) {
      return bracket.ee;
    }
  }
  
  return 1350.00; // Default maximum
}

function calculatePhilHealth(semiMonthlyGross) {
  // semiMonthlyGross is the semi-monthly gross pay
  const monthlyGross = semiMonthlyGross * 2; // convert to monthly
  
  // PhilHealth formula: Premium = Monthly Basic Salary * 0.045 (total)
  // Employee share is half of this (2.25%)
  const employeeShareRate = 0.0225; // 2.25% employee share
  
  // Apply minimum floor of ₱10,000 and maximum ceiling of ₱100,000
  let basis = monthlyGross;
  if (monthlyGross < 10000) {
    basis = 10000; // Minimum
  } else if (monthlyGross > 100000) {
    basis = 100000; // Maximum
  }
  
  const monthlyEmployeeShare = basis * employeeShareRate;
  const semiMonthlyDeduction = monthlyEmployeeShare / 2;
  return roundToDecimal(semiMonthlyDeduction, 2);
}

function calculatePagibig(monthlyGross) {
    if (monthlyGross <= 1500) return roundToDecimal(monthlyGross * 0.01, 2);
    return Math.min(roundToDecimal(monthlyGross * 0.02, 2), 200);
}

function calculateBIRWithholdingTax(taxableIncomeSemiMonthly) {
    const table = [
        { maxIncome: 10416.50, fixed: 0, percent: 0, compensationLevel: 0 },
        { maxIncome: 16666.50, fixed: 0, percent: 15, compensationLevel: 10416.50 },
        { maxIncome: 33332.50, fixed: 1250.00, percent: 20, compensationLevel: 16666.50 },
        { maxIncome: 83332.50, fixed: 5416.67, percent: 25, compensationLevel: 33332.50 },
        { maxIncome: 333332.50, fixed: 20416.67, percent: 30, compensationLevel: 83332.50 },
        { maxIncome: Infinity, fixed: 100416.67, percent: 35, compensationLevel: 333332.50 }
    ];

    for (const bracket of table) {
        if (taxableIncomeSemiMonthly <= bracket.maxIncome) {
            if (bracket.percent === 0) return 0;
            const excess = taxableIncomeSemiMonthly - bracket.compensationLevel;
            return roundToDecimal(bracket.fixed + (excess * (bracket.percent / 100)), 2);
        }
    }
    return 0;
}

function roundToDecimal(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

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

    const sections = ['.hero-stats-grid', '.visual-insights-grid', '.action-activity-grid'];
    sections.forEach(selector => {
        const section = document.querySelector(selector);
        if (section) section.style.display = 'none';
    });
}

function hideOverviewEmptyState() {
    const el = document.getElementById('overviewEmptyState');
    if (el) el.style.display = 'none';

    const sections = ['.hero-stats-grid', '.visual-insights-grid', '.action-activity-grid'];
    sections.forEach(selector => {
        const section = document.querySelector(selector);
        if (section) section.style.display = '';
    });
}

window.addEventListener('beforeunload', () => {
    cleanupListeners();
    cleanupThemeObserver();
});