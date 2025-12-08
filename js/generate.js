let rateType = 'hourly';
let calculatedPayslip = null;
let generatedPayslipUrl = null;
let employeeInfo = { name: '', position: '', email: '', initials: '--' };
let payslipHistory = [];
let currentPremiumRates = { 
    overtimeMultiplier: 1.25, 
    nightDiffMultiplier: 0.10 
};

auth.onAuthStateChanged(async user => {
  if (user) {
    await loadEmployeeInfo(user);
    initializeGeneratePayslip();
    setupDutyUpdateListener();
    loadPayslipHistory();
  }
});

async function loadEmployeeInfo(user) {
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      employeeInfo.name = data.fullName || user.email.split('@')[0];
      employeeInfo.position = data.position || 'Employee';
      employeeInfo.email = data.email || user.email;
      employeeInfo.photoURL = data.photoURL || null;
      employeeInfo.initials = employeeInfo.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    } else {
      employeeInfo.name = user.email.split('@')[0];
      employeeInfo.email = user.email;
      employeeInfo.position = 'Employee';
      employeeInfo.photoURL = null;
      employeeInfo.initials = user.email.substring(0, 2).toUpperCase();
    }
    updateEmployeeDisplay();
  } catch (error) {
    employeeInfo.name = user.email.split('@')[0];
    employeeInfo.email = user.email;
    updateEmployeeDisplay();
  }
}

function updateEmployeeDisplay() {
  const els = {
    'previewEmployeeName': employeeInfo.name,
    'previewEmployeePosition': employeeInfo.position,
    'previewEmployeeEmail': employeeInfo.email
  };
  
  Object.entries(els).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && !id.includes('Avatar')) {
      el.textContent = value;
    }
  });
  updateAvatarDisplay();
}

function updateAvatarDisplay() {
  const previewEmployeeAvatar = document.getElementById('previewEmployeeAvatar');
  if (previewEmployeeAvatar) {
    previewEmployeeAvatar.innerHTML = '';
    if (employeeInfo.photoURL) {
      const img = document.createElement('img');
      img.src = employeeInfo.photoURL;
      img.alt = 'Employee Avatar';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '50%';
      previewEmployeeAvatar.appendChild(img);
    } else {
      previewEmployeeAvatar.textContent = employeeInfo.initials;
    }
  }
}

function setupDutyUpdateListener() {
  const user = auth.currentUser;
  if (!user) return;

  db.collection('duties').where('user', '==', user.uid).onSnapshot(() => {
    fetchAndCalculateHours();
  });

  db.collection('users').doc(user.uid).onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      employeeInfo.name = data.fullName || user.email.split('@')[0];
      employeeInfo.position = data.position || 'Employee';
      employeeInfo.email = data.email || user.email;
      employeeInfo.photoURL = data.photoURL || null;
      employeeInfo.initials = employeeInfo.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      
      if (window.savedPremiumRates) {
        window.savedPremiumRates.overtimeMultiplier = data.overtimeMultiplier || 1.25;
        window.savedPremiumRates.nightDiffMultiplier = data.nightDiffMultiplier || 0.10;
      }
      
      updateEmployeeDisplay();
    }
  });

  db.collection('users').doc(user.uid).onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      currentPremiumRates.overtimeMultiplier = data.overtimeMultiplier ? parseFloat(data.overtimeMultiplier) : 1.25;
      currentPremiumRates.nightDiffMultiplier = data.nightDiffMultiplier ? parseFloat(data.nightDiffMultiplier) : 0.10;
    }
  });
}

function initializeGeneratePayslip() {
  populateYearDropdown();
  setCurrentPeriod();
  setupEventListeners();
  loadJsPDF();
}

async function loadJsPDF() {
  if (window.jspdf) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(script);
  });
}

function populateYearDropdown() {
  const yearSelect = document.getElementById('generateYear');
  if (!yearSelect) return;
  const currentYear = new Date().getFullYear();
  yearSelect.innerHTML = '';
  for (let y = currentYear; y >= currentYear - 5; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }
}

function setCurrentPeriod() {
  const now = new Date();
  const monthSelect = document.getElementById('generateMonth');
  const cutoffSelect = document.getElementById('generateCutoff');
  if (monthSelect) monthSelect.value = now.getMonth() + 1;
  if (cutoffSelect) cutoffSelect.value = now.getDate() <= 15 ? '1' : '2';
  updatePreviewPeriod();
}

function setupEventListeners() {
  document.querySelectorAll('.rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rate-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rateType = btn.dataset.type;
      document.getElementById('rateLabel').textContent = rateType === 'hourly' ? '/hour' : '/day';
    });
  });

  ['generateYear', 'generateMonth', 'generateCutoff'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      updatePreviewPeriod();
      fetchAndCalculateHours();
    });
  });

  const calcBtn = document.getElementById('calculatePayslipBtn');
  if (calcBtn) calcBtn.addEventListener('click', calculatePayslip);

  const genBtn = document.getElementById('generatePdfBtn');
  if (genBtn) genBtn.addEventListener('click', generateAndSavePayslip);

  const viewBtn = document.getElementById('viewPayslipBtn');
  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      if (generatedPayslipUrl) window.open(generatedPayslipUrl, '_blank');
      closeSuccessModal();
    });
  }

  fetchAndCalculateHours();
}

function updatePreviewPeriod() {
  const year = document.getElementById('generateYear')?.value;
  const month = document.getElementById('generateMonth')?.value;
  const cutoff = document.getElementById('generateCutoff')?.value;
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const cutoffText = cutoff === '1' ? '1-15' : '16-30/31';
  const previewEl = document.getElementById('previewPeriod');
  if (previewEl) previewEl.textContent = `${monthNames[month - 1]} ${cutoffText}, ${year}`;
}

async function fetchAndCalculateHours() {
  const user = auth.currentUser;
  if (!user) return;
  const year = parseInt(document.getElementById('generateYear')?.value);
  const month = parseInt(document.getElementById('generateMonth')?.value);
  const cutoff = parseInt(document.getElementById('generateCutoff')?.value);

  try {
    const snapshot = await db.collection('duties').where('user', '==', user.uid).get();
    let regularHoursPayable = 0;
    let overtimeHoursPayable = 0;
    let holidayPayAccumulator = 0;
    let nightDiffHours = 0;
    let statsRegular = 0;
    let statsOvertime = 0;
    let statsHoliday = 0;
    let statsNight = 0;
    let grandTotalHours = 0;

    snapshot.forEach(doc => {
      const duty = doc.data();
      const [y, m, d] = duty.date.split('-').map(Number);
      if (y !== year || m !== month) return;
      if (cutoff === 1 && d > 15) return;
      if (cutoff === 2 && d <= 15) return;

      const regular = parseFloat(duty.regularHours) || 0;
      const night = parseFloat(duty.nightHours) || 0;
      const overtime = parseFloat(duty.overtimeHours) || 0;
      const dayType = duty.dayType || 'Regular';
      const totalDuration = regular + night;
      const isHoliday = dayType.includes('Holiday') || dayType.includes('Special');

      grandTotalHours += totalDuration;
      statsNight += night;
      statsOvertime += overtime;
      if (isHoliday) statsHoliday += totalDuration;
      else statsRegular += Math.max(0, totalDuration - overtime);

      nightDiffHours += night;

      if (isHoliday) {
          let multiplier = 1.0;
          if (dayType.includes('200')) multiplier = 2.00;
          else if (dayType.includes('130')) multiplier = 1.30;
          
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

    document.getElementById('summaryRegularHours').textContent = statsRegular.toFixed(2);
    document.getElementById('summaryOvertimeHours').textContent = statsOvertime.toFixed(2);
    document.getElementById('summaryNightHours').textContent = statsNight.toFixed(2);
    document.getElementById('summaryHolidayHours').textContent = statsHoliday.toFixed(2);
    document.getElementById('summaryWorkedHours').textContent = grandTotalHours.toFixed(2);

    window.fetchedHours = {
      regularHours: regularHoursPayable,
      overtimeHours: overtimeHoursPayable,
      nightHours: nightDiffHours,
      holidayHours: statsHoliday,
      holidayPayAcc: holidayPayAccumulator,
      totalWorked: grandTotalHours
    };
  } catch (error) {
    showToast('Failed to fetch duty hours', 'error');
  }
}

function calculatePayslip() {
  const rate = parseFloat(document.getElementById('rateInput')?.value) || 0;
  if (rate <= 0) {
    showToast('Please enter a valid rate', 'warning');
    return;
  }

  const hours = window.fetchedHours || { regularHours: 0, overtimeHours: 0, nightHours: 0, holidayHours: 0, holidayPayAcc: 0, totalWorked: 0 };
  if (hours.totalWorked === 0) {
    showToast('No duty hours found for this period. Please add duty entries first.', 'warning');
    return;
  }

  const hourlyRate = rateType === 'daily' ? roundToDecimal(rate / 8, 4) : rate;
  const overtimeMultiplier = currentPremiumRates.overtimeMultiplier;
  const nightDiffMultiplier = currentPremiumRates.nightDiffMultiplier;

  const basicRegularHours = Math.max(0, hours.regularHours - hours.nightHours);
  const basicPay = roundToDecimal(basicRegularHours * hourlyRate, 2);
  
  const nightRegularPay = roundToDecimal(hours.nightHours * hourlyRate, 2);
  const nightPremiumPay = roundToDecimal(hours.nightHours * hourlyRate * nightDiffMultiplier, 2);
  const totalNightPay = roundToDecimal(nightRegularPay + nightPremiumPay, 2);
  
  const overtimePay = roundToDecimal(hours.overtimeHours * hourlyRate * overtimeMultiplier, 2);
  const holidayPay = roundToDecimal(hours.holidayPayAcc * hourlyRate, 2);
  
  const grossPay = roundToDecimal(basicPay + totalNightPay + overtimePay + holidayPay, 2);

  const sssDeduction = roundToDecimal(calculateSSS(grossPay * 2) / 2, 2);
  const philhealthDeduction = roundToDecimal(calculatePhilHealth(grossPay * 2), 2);
  const pagibigDeduction = roundToDecimal(calculatePagibig(grossPay * 2) / 2, 2);
  const taxableIncome = roundToDecimal(grossPay - (sssDeduction + philhealthDeduction + pagibigDeduction), 2);
  const withholdingTax = calculateBIRWithholdingTax(taxableIncome);
  const totalDeductions = roundToDecimal(sssDeduction + philhealthDeduction + pagibigDeduction + withholdingTax, 2);
  const netPay = roundToDecimal(grossPay - totalDeductions, 2);

  document.getElementById('previewBasicPay').textContent = formatCurrency(basicPay);
  document.getElementById('previewOvertimePay').textContent = formatCurrency(overtimePay);
  document.getElementById('previewNightDiff').textContent = formatCurrency(totalNightPay);
  document.getElementById('previewHolidayPay').textContent = formatCurrency(holidayPay);
  document.getElementById('previewGrossPay').textContent = formatCurrency(grossPay);
  document.getElementById('previewSSS').textContent = formatCurrency(sssDeduction);
  document.getElementById('previewPhilHealth').textContent = formatCurrency(philhealthDeduction);
  document.getElementById('previewPagibig').textContent = formatCurrency(pagibigDeduction);
  document.getElementById('previewBIRTax').textContent = formatCurrency(withholdingTax);
  document.getElementById('previewTotalDeductions').textContent = formatCurrency(totalDeductions);
  document.getElementById('previewNetPay').textContent = formatCurrency(netPay);

  calculatedPayslip = {
    basicPay, 
    overtimePay, 
    nightRegularPay,
    nightPremiumPay,
    totalNightPay,
    holidayPay, 
    grossPay,
    sss: sssDeduction, 
    philhealth: philhealthDeduction, 
    pagibig: pagibigDeduction,
    withholdingTax, 
    totalDeductions, 
    netPay, 
    hours, 
    hourlyRate,
    employee: { ...employeeInfo },
    overtimeMultiplier,
    nightDiffMultiplier
  };

  document.getElementById('generatePdfBtn').disabled = false;
  showToast('Payslip calculated successfully', 'success');
}

function roundToDecimal(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
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
  
  for (const bracket of brackets) {
    if (monthlyGross >= bracket.min && monthlyGross <= bracket.max) {
      return bracket.ee;
    }
  }
  
  return 1350.00;
}

function calculatePhilHealth(semiMonthlyGross) {
  const monthlyGross = semiMonthlyGross * 2;
  const employeeShareRate = 0.0225;

  let basis = monthlyGross;
  if (monthlyGross < 10000) {
    basis = 10000;
  } else if (monthlyGross > 100000) {
    basis = 100000;
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
  const semiMonthlyTable = [
    { maxIncome: 10416.50, fixed: 0, percent: 0, compensationLevel: 0 },
    { maxIncome: 16666.50, fixed: 0, percent: 15, compensationLevel: 10416.50 },
    { maxIncome: 33332.50, fixed: 1250.00, percent: 20, compensationLevel: 16666.50 },
    { maxIncome: 83332.50, fixed: 5416.67, percent: 25, compensationLevel: 33332.50 },
    { maxIncome: 83332.50, fixed: 20416.67, percent: 30, compensationLevel: 83332.50 },
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

async function checkPayslipExists(year, month, cutoff) {
  const user = auth.currentUser;
  if (!user) return false;
  const docId = `${year}_${month}_${cutoff}`;
  try {
    const docRef = db.collection('payslip_history').doc(user.uid).collection('records').doc(docId);
    const doc = await docRef.get();
    return doc.exists;
  } catch (error) {
    return false;
  }
}

async function generateAndSavePayslip() {
  if (!calculatedPayslip) {
    showToast('Please calculate payslip first', 'warning');
    return;
  }

  const year = document.getElementById('generateYear').value;
  const month = document.getElementById('generateMonth').value;
  const cutoff = document.getElementById('generateCutoff').value;
  const exists = await checkPayslipExists(year, month, cutoff);
  
  if (exists) {
    showToast('Payslip already generated for this period. Check your history below.', 'info');
    document.getElementById('payslipHistorySection')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = monthNames[month - 1];

  try {
    const genBtn = document.getElementById('generatePdfBtn');
    const originalText = genBtn.innerHTML;
    genBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    genBtn.disabled = true;

    await loadJsPDF();
    const pdfBase64 = await createPdfPayslipBase64(year, month, cutoff, monthName);
    await savePayslipToHistory(year, month, cutoff, pdfBase64);
    
    genBtn.innerHTML = originalText;
    genBtn.disabled = false;
    showSuccessModal();
    await loadPayslipHistory();
    setTimeout(() => {
      document.getElementById('payslipHistorySection')?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  } catch (error) {
    showToast('Failed to generate payslip. Please try again.', 'error');
    const genBtn = document.getElementById('generatePdfBtn');
    genBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Download Payslip';
    genBtn.disabled = false;
  }
}

function formatCurrency(amount) {
  return 'PHP ' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function createPdfPayslipBase64(year, month, cutoff, monthName) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const p = calculatedPayslip;
  const cutoffText = cutoff === '1' ? '1-15' : '16-30/31';

  doc.setFillColor(90, 112, 176);
  doc.rect(0, 0, 210, 45, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', 105, 22, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('DutySync Payroll System', 105, 35, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFillColor(245, 247, 250);
  doc.rect(15, 55, 180, 35, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYEE INFORMATION', 20, 63);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Name: ' + employeeInfo.name, 20, 73);
  doc.text('Position: ' + employeeInfo.position, 20, 81);
  doc.text('Email: ' + employeeInfo.email, 110, 73);
  doc.text('Pay Period: ' + monthName + ' ' + cutoffText + ', ' + year, 110, 81);

  let y = 105;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(90, 112, 176);
  doc.text('EARNINGS', 20, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y += 12;

  const addRow = (label, value, bold) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, 25, y);
    doc.text(formatCurrency(value), 180, y, { align: 'right' });
    y += 8;
  };

  addRow('Basic Pay', p.basicPay);
  const otPercent = (p.overtimeMultiplier * 100).toFixed(0);
  const ndPercent = (p.nightDiffMultiplier * 100).toFixed(0);
  addRow(`Night Hours (Regular)`, p.nightRegularPay || 0);
  addRow(`Night Differential (${ndPercent}% premium)`, p.nightPremiumPay || 0);
  addRow('Holiday Pay', p.holidayPay);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 8;
  addRow('GROSS PAY', p.grossPay, true);

  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 53, 69);
  doc.text('DEDUCTIONS', 20, y);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  y += 12;

  addRow('SSS Contribution', p.sss);
  addRow('PhilHealth Contribution', p.philhealth);
  addRow('Pag-IBIG Contribution', p.pagibig);
  addRow('BIR Withholding Tax', p.withholdingTax);
  doc.line(20, y, 190, y);
  y += 8;
  doc.setTextColor(220, 53, 69);
  addRow('TOTAL DEDUCTIONS', p.totalDeductions, true);

  y += 10;
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(15, y, 180, 25, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('NET PAY', 25, y + 16);
  doc.setFontSize(18);
  doc.text(formatCurrency(p.netPay), 185, y + 16, { align: 'right' });

  doc.setTextColor(128, 128, 128);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated on ' + new Date().toLocaleString('en-PH') + ' | Document ID: ' + Date.now(), 105, 285, { align: 'center' });

  const pdfBase64 = doc.output('datauristring').split(',')[1];
  return pdfBase64;
}

async function savePayslipToHistory(year, month, cutoff, pdfBase64) {
  const user = auth.currentUser;
  if (!user) {
    showToast('User not authenticated', 'error');
    throw new Error('User not authenticated');
  }
  if (!calculatedPayslip) {
    showToast('Error: Please calculate the payslip again before saving.', 'error');
    return;
  }

  const docId = `${year}_${month}_${cutoff}`;
  const payslipData = {
    year: parseInt(year),
    month: parseInt(month),
    cutoff: parseInt(cutoff),
    generatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    pdfBase64: pdfBase64,
    employeeName: employeeInfo.name || 'Unknown',
    employeeEmail: employeeInfo.email || 'Unknown',
    netPay: calculatedPayslip.netPay || 0,
    grossPay: calculatedPayslip.grossPay || 0,
    sss: calculatedPayslip.sss || 0,
    philhealth: calculatedPayslip.philhealth || 0,
    pagibig: calculatedPayslip.pagibig || 0,
    withholdingTax: calculatedPayslip.withholdingTax || 0,
    totalDeductions: calculatedPayslip.totalDeductions || 0
  };

  try {
    await db.collection('payslip_history').doc(user.uid).collection('records').doc(docId).set(payslipData);
  } catch (error) {
    showToast('Failed to save payslip', 'error');
    throw error;
  }
}

async function loadPayslipHistory() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const snapshot = await db.collection('payslip_history').doc(user.uid).collection('records').orderBy('generatedAt', 'desc').get();
    payslipHistory = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    renderPayslipHistory();
    updateHistoryCount();
  } catch (error) {
    showToast('Failed to load payslip history', 'error');
  }
}

function updateHistoryCount() {
  const historyCount = document.getElementById('historyCount');
  if (historyCount) historyCount.textContent = payslipHistory.length;
}

function renderPayslipHistory() {
  const container = document.getElementById('payslipHistoryContainer');
  if (!container) return;
  if (payslipHistory.length === 0) {
    container.innerHTML = `
      <div class="history-empty-state">
        <i class="fas fa-file-invoice" style="font-size: 48px; color: #ccc; margin-bottom: 16px;"></i>
        <h3>No Payslip History</h3>
        <p>Generated payslips will appear here</p>
      </div>
    `;
    return;
  }

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  container.innerHTML = payslipHistory.map(record => {
    const monthName = monthNames[record.month - 1];
    const cutoffText = record.cutoff === 1 ? '1-15' : '16-30/31';
    const generatedDate = record.generatedAt ? 
      new Date(record.generatedAt.toDate()).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'N/A';

    return `
      <div class="history-card">
        <div class="history-card-header">
          <div class="history-period">
            <i class="fas fa-calendar-alt"></i>
            <span class="period-text">${monthName} ${cutoffText}, ${record.year}</span>
          </div>
          <span class="history-badge">Generated</span>
        </div>
        <div class="history-card-body">
          <div class="history-info-row">
            <span class="info-label"><i class="fas fa-money-bill-wave"></i> Net Pay:</span>
            <span class="info-value net-pay">${formatCurrency(record.netPay)}</span>
          </div>
          <div class="history-info-row">
            <span class="info-label"><i class="fas fa-coins"></i> Gross Pay:</span>
            <span class="info-value">${formatCurrency(record.grossPay)}</span>
          </div>
          <div class="history-info-row">
            <span class="info-label"><i class="fas fa-clock"></i> Generated:</span>
            <span class="info-value">${generatedDate}</span>
          </div>
        </div>
        <div class="history-card-footer">
          <button class="btn-download-history" onclick="downloadPayslipFromHistory('${record.id}', '${monthName}', ${record.year}, ${record.cutoff})">
            <i class="fas fa-download"></i> Download PDF
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.downloadPayslipFromHistory = async function(docId, monthName, year, cutoff) {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please login to download payslip', 'warning');
    return;
  }

  try {
    const btn = event.target.closest('.btn-download-history');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    btn.disabled = true;

    const doc = await db.collection('payslip_history').doc(user.uid).collection('records').doc(docId).get();
    if (!doc.exists) {
      showToast('Payslip not found', 'error');
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      return;
    }

    const data = doc.data();
    const pdfBase64 = data.pdfBase64;
    const binaryString = atob(pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payslip_${year}_${monthName}_Cutoff${cutoff}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  } catch (error) {
    showToast('Failed to download payslip. Please try again.', 'error');
  }
};

window.deletePayslipFromHistory = async function(docId, periodName) {
  const modal = document.getElementById('deleteConfirmModal');
  if (!modal) {
    if (!confirm(`Are you sure you want to delete the payslip for ${periodName}?\n\nThis action cannot be undone.`)) return;
  } else {
    modal.classList.add('active');
    document.getElementById('confirmDeleteBtn').onclick = async () => {
      modal.classList.remove('active');
      await performPayslipDeletion(docId, periodName);
    };
    document.getElementById('cancelDeleteBtn').onclick = () => modal.classList.remove('active');
    return;
  }
  
  await performPayslipDeletion(docId, periodName);
};

async function performPayslipDeletion(docId, periodName) {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please login to delete payslip', 'warning');
    return;
  }

  try {
    await db.collection('payslip_history').doc(user.uid).collection('records').doc(docId).delete();
    await loadPayslipHistory();
    updateHistoryCount();
    showToast('Payslip deleted successfully', 'success');
  } catch (error) {
    showToast('Failed to delete payslip. Please try again.', 'error');
  }
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

function showSuccessModal() {
  const modal = document.getElementById('payslipSuccessModal');
  if (modal) modal.classList.add('active');
}

async function closeSuccessModal() {
  document.getElementById('payslipSuccessModal').classList.remove('active');
  document.getElementById('generatePdfBtn').disabled = false;
  calculatedPayslip = null;
  
  ['previewBasicPay','previewOvertimePay','previewNightDiff','previewHolidayPay',
   'previewGrossPay','previewSSS','previewPhilHealth','previewPagibig','previewBIRTax',
   'previewTotalDeductions','previewNetPay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = 'PHP 0.00';
  });
}