console.log("💰 netpaytrends.js loaded");

// --- Global Variables ---
let netPayData = [];
let netPayChartInstance = null;
let currentView = '6months'; // '6months' or '12months'

// --- Initialize on Auth Change ---
auth.onAuthStateChanged(user => {
    if (user) {
        initializeNetPayFilters();
        loadNetPayData(user.uid);
        setupNetPayEventListeners();
    }
});

// --- 1. Initialize Filters ---
function initializeNetPayFilters() {
    const yearSelect = document.getElementById('netpayYear');
    
    if (!yearSelect) {
        console.warn("⚠️ 'netpayYear' element not found in HTML");
        return;
    }
    
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '<option value="all">All Years</option>';
    
    for (let y = currentYear; y >= currentYear - 5; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    console.log("✅ Net Pay Year Filter Populated");
}

// --- 2. Load Data from Firestore (REAL-TIME LISTENER) ---
let netPayListenerUnsubscribe = null;

function loadNetPayData(userId) {
    console.log(`🔥 Setting up real-time net pay listener for: ${userId}`);
    
    if (netPayListenerUnsubscribe) {
        netPayListenerUnsubscribe();
    }

    netPayListenerUnsubscribe = db.collection('payslip_history')
        .doc(userId)
        .collection('records')
        .onSnapshot(snapshot => {
            netPayData = [];
        
            snapshot.forEach(doc => {
                const data = doc.data();
                netPayData.push({
                    year: data.year,
                    month: data.month,
                    cutoff: data.cutoff,
                    netPay: data.netPay || 0,
                    grossPay: data.grossPay || 0,
                    totalDeductions: data.totalDeductions || 0,
                    generatedAt: data.generatedAt
                });
            });
            
            // Sort: Newest first for display, oldest first for charts
            netPayData.sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                if (a.month !== b.month) return a.month - b.month;
                return a.cutoff - b.cutoff;
            });
            
            console.log(`✅ Real-time update: ${netPayData.length} net pay records loaded`);
            
            renderNetPayUI();
            
        }, error => {
            console.error('❌ Error in net pay listener:', error);
            showNetPayEmptyState();
        });
}

// --- 3. Render UI (Master Function) ---
function renderNetPayUI() {
    const yearFilter = document.getElementById('netpayYear')?.value || 'all';

    console.log(`🔍 Filtering Net Pay: Year=${yearFilter}`);

    let filteredData = netPayData.filter(item => {
        return yearFilter === 'all' || item.year.toString() === yearFilter;
    });
    
    if (filteredData.length === 0) {
        showNetPayEmptyState();
        return;
    }
    
    hideNetPayEmptyState();

    // Update all sections
    updateComparisonCards(filteredData);
    renderNetPayTrendChart(filteredData);
    updateInsightsCards(filteredData);
    updateProjectionCard(filteredData);
    renderNetPayTable(filteredData);
}

// --- 4. Update Comparison Cards ---
function updateComparisonCards(data) {
    if (data.length === 0) return;

    const currentPeriod = data[data.length - 1];
    const previousPeriod = data[data.length - 2];
    
    // Current Period
    setText('currentNetPay', formatCurrency(currentPeriod.netPay));
    setText('currentPeriodLabel', `${getMonthName(currentPeriod.month)} ${currentPeriod.cutoff === 1 ? '1-15' : '16-30'}, ${currentPeriod.year}`);
    
    // Previous Period
    if (previousPeriod) {
        setText('previousNetPay', formatCurrency(previousPeriod.netPay));
        setText('previousPeriodLabel', `${getMonthName(previousPeriod.month)} ${previousPeriod.cutoff === 1 ? '1-15' : '16-30'}, ${previousPeriod.year}`);
        
        // Calculate Change
        const change = currentPeriod.netPay - previousPeriod.netPay;
        const changePercent = previousPeriod.netPay > 0 ? ((change / previousPeriod.netPay) * 100).toFixed(1) : 0;
        
        const badge = document.getElementById('comparisonBadge');
        if (badge) {
            badge.className = 'comparison-badge';
            if (change > 0) {
                badge.classList.add('increase');
                badge.innerHTML = `<i class="fas fa-arrow-up"></i> +${changePercent}%`;
            } else if (change < 0) {
                badge.classList.add('decrease');
                badge.innerHTML = `<i class="fas fa-arrow-down"></i> ${changePercent}%`;
            } else {
                badge.classList.add('neutral');
                badge.innerHTML = `<i class="fas fa-minus"></i> 0%`;
            }
        }
    } else {
        setText('previousNetPay', 'N/A');
        setText('previousPeriodLabel', 'No previous data');
        const badge = document.getElementById('comparisonBadge');
        if (badge) {
            badge.className = 'comparison-badge neutral';
            badge.innerHTML = `<i class="fas fa-minus"></i> N/A`;
        }
    }
    
    // Average Net Pay
    const avgNetPay = data.reduce((sum, item) => sum + item.netPay, 0) / data.length;
    setText('averageNetPay', formatCurrency(avgNetPay));
    
    // YTD Total
    const currentYear = new Date().getFullYear();
    const ytdData = data.filter(item => item.year === currentYear);
    const ytdTotal = ytdData.reduce((sum, item) => sum + item.netPay, 0);
    setText('ytdNetPay', formatCurrency(ytdTotal));
    setText('ytdCount', `${ytdData.length} ${ytdData.length === 1 ? 'period' : 'periods'}`);
}

// --- 5. Render Trend Chart ---
function renderNetPayTrendChart(data) {
    const ctx = document.getElementById('netPayTrendChart');
    if (!ctx) return;

    const displayData = currentView === '6months' ? data.slice(-12) : data.slice(-24);
    
    const labels = [];
    const netPayValues = [];
    const grossPayValues = [];
    
    displayData.forEach(item => {
        labels.push(`${getMonthName(item.month).substring(0, 3)} ${item.cutoff === 1 ? '1st' : '2nd'}`);
        netPayValues.push(item.netPay);
        grossPayValues.push(item.grossPay);
    });

    if (netPayChartInstance) netPayChartInstance.destroy();

    netPayChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Net Pay',
                    data: netPayValues,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Gross Pay',
                    data: grossPayValues,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.05)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 12
                    },
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ₱' + context.parsed.y.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '₱' + value.toLocaleString('en-PH');
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// --- 6. Update Insights Cards ---
function updateInsightsCards(data) {
    if (data.length === 0) return;

    // Hours Correlation (Need to fetch from duties - for now use placeholder)
    setText('totalPeriodsWorked', data.length);
    setText('avgHoursPerPeriod', 'N/A'); // Would need duty data
    
    // Earnings Breakdown
    const totalNetPay = data.reduce((sum, item) => sum + item.netPay, 0);
    const totalGrossPay = data.reduce((sum, item) => sum + item.grossPay, 0);
    const totalDeductions = data.reduce((sum, item) => sum + item.totalDeductions, 0);
    
    setText('totalEarningsGross', formatCurrency(totalGrossPay));
    setText('totalEarningsNet', formatCurrency(totalNetPay));
    setText('totalDeductionsInsight', formatCurrency(totalDeductions));
    
    // Best & Worst Months
    const sortedByNetPay = [...data].sort((a, b) => b.netPay - a.netPay);
    const bestMonth = sortedByNetPay[0];
    const worstMonth = sortedByNetPay[sortedByNetPay.length - 1];
    
    setText('bestMonthLabel', `${getMonthName(bestMonth.month)} ${bestMonth.year}`);
    setText('bestMonthValue', formatCurrency(bestMonth.netPay));
    setText('worstMonthLabel', `${getMonthName(worstMonth.month)} ${worstMonth.year}`);
    setText('worstMonthValue', formatCurrency(worstMonth.netPay));
}

// --- 7. Update Projection Card ---
function updateProjectionCard(data) {
    if (data.length < 2) {
        setText('projectedAnnualIncome', '₱0.00');
        return;
    }

    // Simple projection: Average of last 3 periods * 24 (assuming semi-monthly)
    const recentData = data.slice(-3);
    const avgRecent = recentData.reduce((sum, item) => sum + item.netPay, 0) / recentData.length;
    const projected = avgRecent * 24;
    
    setText('projectedAnnualIncome', formatCurrency(projected));
}

// --- 8. Render Table ---
function renderNetPayTable(data) {
    const tbody = document.getElementById('netPayTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No records found</td></tr>';
        return;
    }
    
    // Reverse for newest first in table
    const reversedData = [...data].reverse();
    
    reversedData.forEach((item, index) => {
        const row = document.createElement('tr');
        const periodText = `${getMonthName(item.month)} ${item.cutoff === 1 ? '1-15' : '16-30'}, ${item.year}`;
        
        // Calculate trend vs previous
        let trendHtml = '<span class="trend-indicator neutral"><i class="fas fa-minus"></i> N/A</span>';
        if (index < reversedData.length - 1) {
            const prevItem = reversedData[index + 1];
            const change = item.netPay - prevItem.netPay;
            const changePercent = prevItem.netPay > 0 ? ((change / prevItem.netPay) * 100).toFixed(1) : 0;
            
            if (change > 0) {
                trendHtml = `<span class="trend-indicator up"><i class="fas fa-arrow-up"></i> +${changePercent}%</span>`;
            } else if (change < 0) {
                trendHtml = `<span class="trend-indicator down"><i class="fas fa-arrow-down"></i> ${changePercent}%</span>`;
            } else {
                trendHtml = '<span class="trend-indicator neutral"><i class="fas fa-minus"></i> 0%</span>';
            }
        }
        
        row.innerHTML = `
            <td>${periodText}</td>
            <td>${formatCurrency(item.grossPay)}</td>
            <td>${formatCurrency(item.totalDeductions)}</td>
            <td style="color: #10b981; font-weight: bold;">${formatCurrency(item.netPay)}</td>
            <td>${trendHtml}</td>
        `;
        tbody.appendChild(row);
    });
}

// --- 9. Event Listeners ---
function setupNetPayEventListeners() {
    // Year Filter
    document.getElementById('netpayYear')?.addEventListener('change', renderNetPayUI);
    
    // View Toggle (6 months vs 12 months)
    const toggle6m = document.getElementById('toggle6months');
    const toggle12m = document.getElementById('toggle12months');
    
    toggle6m?.addEventListener('click', () => {
        currentView = '6months';
        toggle6m.classList.add('active');
        toggle12m.classList.remove('active');
        renderNetPayUI();
    });
    
    toggle12m?.addEventListener('click', () => {
        currentView = '12months';
        toggle12m.classList.add('active');
        toggle6m.classList.remove('active');
        renderNetPayUI();
    });
    
    // Export
    document.getElementById('exportNetPayBtn')?.addEventListener('click', exportNetPayData);
}

// --- 10. Export Data ---
function exportNetPayData() {
    if (netPayData.length === 0) {
        alert('No data to export');
        return;
    }
    
    let csv = 'Period,Gross Pay,Total Deductions,Net Pay,Month,Year,Cutoff\n';
    
    netPayData.forEach(item => {
        const periodText = `${getMonthName(item.month)} ${item.cutoff === 1 ? '1-15' : '16-30'} ${item.year}`;
        csv += `"${periodText}",${item.grossPay},${item.totalDeductions},${item.netPay},${item.month},${item.year},${item.cutoff}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NetPayTrends_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// --- Helper Functions ---
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatCurrency(amount) {
    return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
}

function showNetPayEmptyState() {
    const el = document.getElementById('netPayEmptyState');
    if (el) el.style.display = 'flex';
    
    // Hide all content sections
    const sections = [
        'netPayComparisonCards',
        'netPayTrendChartCard',
        'netPayInsightsGrid',
        'netPayProjectionCard',
        'netPayTableCard'
    ];
    
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = 'none';
    });
}

function hideNetPayEmptyState() {
    const el = document.getElementById('netPayEmptyState');
    if (el) el.style.display = 'none';
    
    // Show all content sections
    const sections = [
        'netPayComparisonCards',
        'netPayTrendChartCard',
        'netPayInsightsGrid',
        'netPayProjectionCard',
        'netPayTableCard'
    ];
    
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = '';
    });
}