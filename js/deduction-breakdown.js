let breakdownData = [];
let donutChartInstance = null;
let trendChartInstance = null;
let breakdownListenerUnsubscribe = null;

auth.onAuthStateChanged(user => {
    if (user) {
        initializeBreakdownFilters();
        loadBreakdownData(user.uid);
        setupBreakdownEventListeners();
    }
});

function initializeBreakdownFilters() {
    const yearSelect = document.getElementById('breakdownYear');
    if (!yearSelect) return;

    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '<option value="all">All Years</option>';

    for (let y = 2035; y >= 2025; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    }
        if (currentYear >= 2025 && currentYear <= 2035) {
        yearSelect.value = currentYear;
    } else {
        yearSelect.value = "all"; 
    }
}

function loadBreakdownData(userId) {
    if (breakdownListenerUnsubscribe) breakdownListenerUnsubscribe();

    breakdownListenerUnsubscribe = db.collection('payslip_history')
        .doc(userId)
        .collection('records')
        .onSnapshot(snapshot => {
            breakdownData = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                breakdownData.push({
                    year: data.year,
                    month: data.month,
                    cutoff: data.cutoff,
                    grossPay: data.grossPay || 0,
                    sss: parseFloat(data.sss) || 0,
                    philhealth: parseFloat(data.philhealth) || 0,
                    pagibig: parseFloat(data.pagibig) || 0,
                    tax: parseFloat(data.withholdingTax) || 0,
                    totalDeductions: parseFloat(data.totalDeductions) || 0,
                    netPay: data.netPay || 0,
                    generatedAt: data.generatedAt
                });
            });
            
            breakdownData.sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                if (a.month !== b.month) return b.month - a.month;
                return b.cutoff - a.cutoff;
            });
            
            renderBreakdownUI();
        }, error => {
            showBreakdownEmptyState();
        });
}

function renderBreakdownUI() {
    const yearFilter = document.getElementById('breakdownYear')?.value || 'all';
    const monthFilter = document.getElementById('breakdownMonth')?.value || 'all';

    let filteredData = breakdownData.filter(item => {
        const matchYear = yearFilter === 'all' || item.year.toString() === yearFilter;
        const matchMonth = monthFilter === 'all' || item.month.toString() === monthFilter;
        return matchYear && matchMonth;
    });
    
    if (filteredData.length === 0) {
        updateSummaryCardsToZero();
        updateRatioCard(0, 0);
        renderDonutChart(0, 0, 0, 0);
        renderBreakdownTable([]);
        const yearOnlyData = breakdownData.filter(item => 
            yearFilter === 'all' || item.year.toString() === yearFilter
        );
        renderTrendChart(yearOnlyData);
        return;
    }
    
    hideBreakdownEmptyState();

    let totalSSS = 0, totalPhil = 0, totalPag = 0, totalTax = 0, totalDed = 0, totalGross = 0, totalNet = 0;

    filteredData.forEach(item => {
        totalSSS += item.sss;
        totalPhil += item.philhealth;
        totalPag += item.pagibig;
        totalTax += item.tax;
        totalDed += item.totalDeductions;
        totalGross += item.grossPay;
        totalNet += item.netPay;
    });

    setText('totalDeductions', formatCurrency(totalDed));
    setText('sssDeduction', formatCurrency(totalSSS));
    setText('philhealthDeduction', formatCurrency(totalPhil));
    setText('pagibigDeduction', formatCurrency(totalPag));
    setText('taxDeduction', formatCurrency(totalTax));

    setPercent('sssPercent', totalSSS, totalDed);
    setPercent('philhealthPercent', totalPhil, totalDed);
    setPercent('pagibigPercent', totalPag, totalDed);
    setPercent('taxPercent', totalTax, totalDed);

    updateRatioCard(totalGross, totalNet);
    renderDonutChart(totalSSS, totalPhil, totalPag, totalTax);
    
    const yearOnlyData = breakdownData.filter(item => yearFilter === 'all' || item.year.toString() === yearFilter);
    renderTrendChart(yearOnlyData);
    renderBreakdownTable(filteredData);
}

function updateSummaryCardsToZero() {
    setText('totalDeductions', '₱0.00');
    setText('sssDeduction', '₱0.00');
    setText('philhealthDeduction', '₱0.00');
    setText('pagibigDeduction', '₱0.00');
    setText('taxDeduction', '₱0.00');
    
    setText('sssPercent', '0%');
    setText('philhealthPercent', '0%');
    setText('pagibigPercent', '0%');
    setText('taxPercent', '0%');
}

function updateRatioCard(gross, net) {
    setText('grossPayDisplay', formatCurrency(gross));
    setText('netPayDisplay', formatCurrency(net));
    
    const ratio = gross > 0 ? (net / gross) * 100 : 0;
    setText('keepPercentage', ratio.toFixed(1) + '%');
    
    const bar = document.getElementById('ratioBar');
    if (bar) {
        bar.style.width = `${ratio}%`;
        if (ratio > 80) bar.style.backgroundColor = '#10B981';
        else if (ratio > 60) bar.style.backgroundColor = '#F59E0B';
        else bar.style.backgroundColor = '#EF4444';
    }
}

function renderDonutChart(sss, phil, pag, tax) {
    const ctx = document.getElementById('deductionDonutChart');
    if (!ctx) return;

    if (donutChartInstance) donutChartInstance.destroy();

    donutChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['SSS', 'PhilHealth', 'Pag-IBIG', 'Tax'],
            datasets: [{
                data: [sss, phil, pag, tax],
                backgroundColor: ['#F59E0B', '#10B981', '#3B82F6', '#EF4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

function renderTrendChart(data) {
    const ctx = document.getElementById('deductionTrendChart');
    if (!ctx) return;

    const sortedData = [...data].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });

    const recentData = sortedData.slice(-6);
    const labels = [];
    const values = [];

    recentData.forEach(item => {
        labels.push(`${getMonthName(item.month)} ${item.cutoff === 1 ? '1st' : '2nd'}`);
        values.push(item.totalDeductions);
    });

    if (trendChartInstance) trendChartInstance.destroy();

    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Deductions',
                data: values,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderBreakdownTable(data) {
    const tbody = document.getElementById('breakdownTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No records found for this period</td></tr>';
        return;
    }
    
    data.forEach(item => {
        const row = document.createElement('tr');
        const periodText = `${getMonthName(item.month)} ${item.cutoff === 1 ? '1-15' : '16-30'}, ${item.year}`;
        
        row.innerHTML = `
            <td>${periodText}</td>
            <td>${formatCurrency(item.grossPay)}</td>
            <td>${formatCurrency(item.sss)}</td>
            <td>${formatCurrency(item.philhealth)}</td>
            <td>${formatCurrency(item.pagibig)}</td>
            <td>${formatCurrency(item.tax)}</td>
            <td><strong>${formatCurrency(item.totalDeductions)}</strong></td>
            <td style="color: #10B981; font-weight: bold;">${formatCurrency(item.netPay)}</td>
        `;
        tbody.appendChild(row);
    });
}

function setupBreakdownEventListeners() {
    document.getElementById('breakdownYear')?.addEventListener('change', renderBreakdownUI);
    document.getElementById('breakdownMonth')?.addEventListener('change', renderBreakdownUI);
    document.getElementById('exportBreakdownBtn')?.addEventListener('click', exportBreakdownData);
}

function exportBreakdownData() {
    if (breakdownData.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }
    
    let csv = 'Period,Gross Pay,SSS,PhilHealth,Pag-IBIG,BIR Tax,Total Deductions,Net Pay\n';
    
    breakdownData.forEach(item => {
        const periodText = `${getMonthName(item.month)} ${item.cutoff === 1 ? '1-15' : '16-30'} ${item.year}`;
        csv += `"${periodText}",${item.grossPay},${item.sss},${item.philhealth},${item.pagibig},${item.tax},${item.totalDeductions},${item.netPay}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Deductions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setPercent(id, value, total) {
    const percent = total > 0 ? (value / total) * 100 : 0;
    setText(id, percent.toFixed(1) + '%');
}

function formatCurrency(amount) {
    return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthName(month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
}

function showBreakdownEmptyState() {
    const el = document.getElementById('breakdownEmptyState');
    if (el) el.style.display = 'flex';
}

function hideBreakdownEmptyState() {
    const el = document.getElementById('breakdownEmptyState');
    if (el) el.style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    const container = document.getElementById('toastContainer') || document.body;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}