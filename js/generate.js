console.log("📄 generate.js loaded (With History System)");

// --- Global Variables ---
let rateType = 'hourly';
let calculatedPayslip = null;
let generatedPayslipUrl = null;
let employeeInfo = { name: '', position: '', email: '', initials: '--' };
let payslipHistory = [];

// Add this variable to store the rates locally in this file
let currentPremiumRates = { 
    overtimeMultiplier: 1.25, 
    nightDiffMultiplier: 0.10 
};

// --- Initialize on Auth State Change ---
auth.onAuthStateChanged(async user => {
  if (user) {
    await loadEmployeeInfo(user);
    initializeGeneratePayslip();
    setupDutyUpdateListener();
    loadPayslipHistory();
  }
});

// --- Load Employee Info from Firestore ---
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
    console.error('Error loading employee info:', error);
    employeeInfo.name = user.email.split('@')[0];
    employeeInfo.email = user.email;
    updateEmployeeDisplay();
  }
}

// --- Update Employee Display in UI ---
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

// --- Update Avatar Display ---
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

// --- Setup Duty Update Listener ---
function setupDutyUpdateListener() {
  const user = auth.currentUser;
  if (!user) return;

  // Listen to duty changes
  db.collection('duties')
    .where('user', '==', user.uid)
    .onSnapshot(() => {
      console.log('📡 Duty data changed, updating payslip preview...');
      fetchAndCalculateHours();
    }, error => {
      console.error('Error listening to duties:', error);
    });

  // ✅ LISTEN TO PREMIUM RATES CHANGES IN REAL-TIME
  db.collection('users').doc(user.uid).onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      
      // Update employee info
      employeeInfo.name = data.fullName || user.email.split('@')[0];
      employeeInfo.position = data.position || 'Employee';
      employeeInfo.email = data.email || user.email;
      employeeInfo.photoURL = data.photoURL || null;
      employeeInfo.photoBase64 = data.photoBase64 || null;
      employeeInfo.initials = employeeInfo.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      
      // ✅ UPDATE PREMIUM RATES
      if (window.savedPremiumRates) {
        window.savedPremiumRates.overtimeMultiplier = data.overtimeMultiplier || 1.25;
        window.savedPremiumRates.nightDiffMultiplier = data.nightDiffMultiplier || 0.10;
        console.log('✅ Premium rates synced:', window.savedPremiumRates);
      }
      
      // Update the display immediately
      updateEmployeeDisplay();
      
      console.log('✅ Profile updated in Generate Payslip:', employeeInfo.name);
    }
  }, error => {
    console.error('Error listening to profile:', error);
  });

  // Add this inside setupDutyUpdateListener()
  db.collection('users').doc(user.uid).onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      
      // Update the local variable immediately
      currentPremiumRates.overtimeMultiplier = data.overtimeMultiplier ? parseFloat(data.overtimeMultiplier) : 1.25;
      currentPremiumRates.nightDiffMultiplier = data.nightDiffMultiplier ? parseFloat(data.nightDiffMultiplier) : 0.10;
      
      console.log('✅ Rates updated:', currentPremiumRates);

      // FORCE RE-CALCULATION immediately if hours have already been fetched
      if(window.fetchedHours) {
        calculatePayslip(); 
      }
    }
  });
  
}

// --- Initialize Generate Payslip ---
function initializeGeneratePayslip() {
  populateYearDropdown();
  setCurrentPeriod();
  setupEventListeners();
  loadJsPDF();
}

// --- Load jsPDF Library ---
async function loadJsPDF() {
  if (window.jspdf) return;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      console.log('✅ jsPDF loaded successfully');
      resolve();
    };
    script.onerror = () => {
      console.error('❌ Failed to load jsPDF');
      reject(new Error('Failed to load jsPDF'));
    };
    document.head.appendChild(script);
  });
}

// --- Populate Year Dropdown ---
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

// --- Set Current Period ---
function setCurrentPeriod() {
  const now = new Date();
  const monthSelect = document.getElementById('generateMonth');
  const cutoffSelect = document.getElementById('generateCutoff');
  
  if (monthSelect) monthSelect.value = now.getMonth() + 1;
  if (cutoffSelect) cutoffSelect.value = now.getDate() <= 15 ? '1' : '2';
  
  updatePreviewPeriod();
}

// --- Setup Event Listeners ---
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
    if (el) {
      el.addEventListener('change', () => {
        updatePreviewPeriod();
        fetchAndCalculateHours();
      });
    }
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

// --- Update Preview Period Text ---
function updatePreviewPeriod() {
  const year = document.getElementById('generateYear')?.value;
  const month = document.getElementById('generateMonth')?.value;
  const cutoff = document.getElementById('generateCutoff')?.value;
  
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const cutoffText = cutoff === '1' ? '1-15' : '16-30/31';
  
  const previewEl = document.getElementById('previewPeriod');
  if (previewEl) {
    previewEl.textContent = `${monthNames[month - 1]} ${cutoffText}, ${year}`;
  }
}

// --- Fetch Hours from Duty Logs (STRICT CALCULATION) ---
async function fetchAndCalculateHours() {
  const user = auth.currentUser;
  if (!user) return;

  const year = parseInt(document.getElementById('generateYear')?.value);
  const month = parseInt(document.getElementById('generateMonth')?.value);
  const cutoff = parseInt(document.getElementById('generateCutoff')?.value);

  try {
    const snapshot = await db.collection('duties').where('user', '==', user.uid).get();

    // 1. Buckets for PAYSLIP CALCULATION (Money)
    let regularHoursPayable = 0;   // For Basic Pay
    let overtimeHoursPayable = 0;  // For Regular OT Pay only
    let holidayPayAccumulator = 0; // For Holiday Pay (Base + OT combined)
    let nightDiffHours = 0;        // For Night Differential

    // 2. Buckets for UI DISPLAY (Stats only)
    let statsRegular = 0;
    let statsOvertime = 0;
    let statsHoliday = 0;
    let statsNight = 0;
    let grandTotalHours = 0; // <--- NEW: To track accurate physical time

    snapshot.forEach(doc => {
      const duty = doc.data();
      const [y, m, d] = duty.date.split('-').map(Number);

      if (y !== year || m !== month) return;
      if (cutoff === 1 && d > 15) return;
      if (cutoff === 2 && d <= 15) return;

      // Raw Data
      const regular = parseFloat(duty.regularHours) || 0;
      const night = parseFloat(duty.nightHours) || 0;
      const overtime = parseFloat(duty.overtimeHours) || 0;
      const dayType = duty.dayType || 'Regular';
      const totalDuration = regular + night; // Total physical duration of the shift

      const isHoliday = dayType.includes('Holiday') || dayType.includes('Special');

      // --- STATISTICS ---
      grandTotalHours += totalDuration; // <--- NEW: Add physical hours here
      statsNight += night;
      statsOvertime += overtime;
      
      if (isHoliday) statsHoliday += totalDuration;
      else statsRegular += Math.max(0, totalDuration - overtime);

      // --- PAYSLIP CALCULATION (Money Logic) ---
      nightDiffHours += night;

      if (isHoliday) {
        // --- HOLIDAY LOGIC (Corrected) ---
        let multiplier = 1.0;
        if (dayType.includes('130')) multiplier = 1.30;
        if (dayType.includes('200')) multiplier = 2.00;

        const holidayBaseHours = Math.max(0, totalDuration - overtime);
        const holidayOTHours = overtime;

        // Base Pay
        holidayPayAccumulator += holidayBaseHours * multiplier;
        
        // OT Pay (Base Rate * Multiplier * 1.3 Premium)
        if (holidayOTHours > 0) {
            holidayPayAccumulator += holidayOTHours * (multiplier * 1.3);
        }

      } else {
        // --- REGULAR DAY LOGIC ---
        const basic = Math.max(0, totalDuration - overtime);
        regularHoursPayable += basic;
        overtimeHoursPayable += overtime;
      }
    });

    // UPDATE UI
    document.getElementById('summaryRegularHours').textContent = statsRegular.toFixed(2);
    document.getElementById('summaryOvertimeHours').textContent = statsOvertime.toFixed(2);
    document.getElementById('summaryNightHours').textContent = statsNight.toFixed(2);
    document.getElementById('summaryHolidayHours').textContent = statsHoliday.toFixed(2);
    
    // FIXED: Use grandTotalHours instead of summing the buckets
    document.getElementById('summaryWorkedHours').textContent = grandTotalHours.toFixed(2); 

    console.log('📊 Stats:', { statsRegular, statsOvertime, statsHoliday, grandTotalHours });

    // PASS DATA TO CALCULATOR
    window.fetchedHours = {
      regularHours: regularHoursPayable,
      overtimeHours: overtimeHoursPayable,
      nightHours: nightDiffHours,
      holidayHours: statsHoliday,
      holidayPayAcc: holidayPayAccumulator,
      totalWorked: grandTotalHours // FIXED
    };
  } catch (error) {
    console.error('Error fetching duties:', error);
  }
}

// --- Calculate Payslip ---
function calculatePayslip() {
  const rate = parseFloat(document.getElementById('rateInput')?.value) || 0;
  if (rate <= 0) {
    alert('Please enter a valid rate');
    return;
  }

  const hours = window.fetchedHours || { regularHours: 0, overtimeHours: 0, nightHours: 0, holidayHours: 0, holidayPayAcc: 0, totalWorked: 0 };
  
  // CHECK IF NO DUTIES OR HOURS FOUND
  if (hours.totalWorked === 0) {
    alert('No duty hours found for this period. Please add duty entries first.');
    return;
  }

  const hourlyRate = rateType === 'daily' ? roundToDecimal(rate / 8, 4) : rate;

  // ✅ USE SAVED PREMIUM RATES FROM SETTINGS
  const overtimeMultiplier = currentPremiumRates.overtimeMultiplier;
  const nightDiffMultiplier = currentPremiumRates.nightDiffMultiplier;

  const basicPay = roundToDecimal(hours.regularHours * hourlyRate, 2);
  const overtimePay = roundToDecimal(hours.overtimeHours * hourlyRate * overtimeMultiplier, 2);  // ✅ DYNAMIC
  const nightDiffPay = roundToDecimal(hours.nightHours * hourlyRate * nightDiffMultiplier, 2);   // ✅ DYNAMIC
  const holidayPay = roundToDecimal(hours.holidayPayAcc * hourlyRate, 2);

  const grossPay = roundToDecimal(basicPay + overtimePay + nightDiffPay + holidayPay, 2);

  const sssDeduction = roundToDecimal(calculateSSS(grossPay * 2) / 2, 2);
  const philhealthDeduction = roundToDecimal(calculatePhilHealth(grossPay * 2), 2);
  const pagibigDeduction = roundToDecimal(calculatePagibig(grossPay * 2) / 2, 2);

  const taxableIncome = roundToDecimal(grossPay - (sssDeduction + philhealthDeduction + pagibigDeduction), 2);
  const withholdingTax = calculateBIRWithholdingTax(taxableIncome);

  const totalDeductions = roundToDecimal(sssDeduction + philhealthDeduction + pagibigDeduction + withholdingTax, 2);
  const netPay = roundToDecimal(grossPay - totalDeductions, 2);

  document.getElementById('previewBasicPay').textContent = formatCurrency(basicPay);
  document.getElementById('previewOvertimePay').textContent = formatCurrency(overtimePay);
  document.getElementById('previewNightDiff').textContent = formatCurrency(nightDiffPay);
  document.getElementById('previewHolidayPay').textContent = formatCurrency(holidayPay);
  document.getElementById('previewGrossPay').textContent = formatCurrency(grossPay);
  document.getElementById('previewSSS').textContent = formatCurrency(sssDeduction);
  document.getElementById('previewPhilHealth').textContent = formatCurrency(philhealthDeduction);
  document.getElementById('previewPagibig').textContent = formatCurrency(pagibigDeduction);
  document.getElementById('previewBIRTax').textContent = formatCurrency(withholdingTax);
  document.getElementById('previewTotalDeductions').textContent = formatCurrency(totalDeductions);
  document.getElementById('previewNetPay').textContent = formatCurrency(netPay);

  calculatedPayslip = {
    basicPay, overtimePay, nightDiffPay, holidayPay, grossPay,
    sss: sssDeduction, philhealth: philhealthDeduction, pagibig: pagibigDeduction,
    withholdingTax, totalDeductions, netPay, hours, hourlyRate,
    employee: { ...employeeInfo },
    // ✅ SAVE THE MULTIPLIERS USED IN THIS PAYSLIP
    overtimeMultiplier,
    nightDiffMultiplier
  };

  document.getElementById('generatePdfBtn').disabled = false;
  console.log('✅ Payslip calculated with custom premium rates:', calculatedPayslip);
}

// --- Round to Decimal ---
function roundToDecimal(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
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

// --- Format Currency ---
function formatCurrency(amount) {
  return 'PHP ' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ========================================
// PAYSLIP HISTORY SYSTEM
// ========================================

// --- Check if Payslip Already Exists ---
async function checkPayslipExists(year, month, cutoff) {
  const user = auth.currentUser;
  if (!user) return false;

  const docId = `${year}_${month}_${cutoff}`;
  
  try {
    const docRef = db.collection('payslip_history')
      .doc(user.uid)
      .collection('records')
      .doc(docId);
    
    const doc = await docRef.get();
    return doc.exists;
  } catch (error) {
    console.error('Error checking payslip existence:', error);
    return false;
  }
}

// --- Generate and Save Payslip (WITH DUPLICATE CHECK) ---
async function generateAndSavePayslip() {
  console.log('🚀 Generating payslip with duplicate check...');

  if (!calculatedPayslip) {
    alert('Please calculate payslip first');
    return;
  }

  const year = document.getElementById('generateYear').value;
  const month = document.getElementById('generateMonth').value;
  const cutoff = document.getElementById('generateCutoff').value;

  const exists = await checkPayslipExists(year, month, cutoff);
  
  if (exists) {
    alert('⚠️ Payslip already generated for this period. Please check your history below.');
    document.getElementById('payslipHistorySection')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const monthNames = [
    'January','February','March','April','May','June','July',
    'August','September','October','November','December'
  ];
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
    console.error('Error generating payslip:', error);
    alert('Failed to generate payslip. Please try again.');
    const genBtn = document.getElementById('generatePdfBtn');
    genBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Download Payslip';
    genBtn.disabled = false;
  }
}

// --- Create PDF and Convert to Base64 ---
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
  addRow(`Overtime Pay (${otPercent}% premium)`, p.overtimePay);
  addRow(`Night Differential (${ndPercent}% premium)`, p.nightDiffPay);
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

// --- Save Payslip to Firestore (Fixed & Robust) ---
async function savePayslipToHistory(year, month, cutoff, pdfBase64) {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  // Safety check: ensure calculations exist
  if (!calculatedPayslip) {
    console.error("❌ No calculated payslip data found.");
    alert("Error: Please calculate the payslip again before saving.");
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
    
    // Financials (Added || 0 to prevent undefined/NaN errors)
    netPay: calculatedPayslip.netPay || 0,
    grossPay: calculatedPayslip.grossPay || 0,
    
    // Breakdown Fields (Crucial for Analytics)
    sss: calculatedPayslip.sss || 0,
    philhealth: calculatedPayslip.philhealth || 0,
    pagibig: calculatedPayslip.pagibig || 0,
    withholdingTax: calculatedPayslip.withholdingTax || 0, // Maps to 'tax' in analytics
    totalDeductions: calculatedPayslip.totalDeductions || 0
  };

  try {
    await db.collection('payslip_history')
      .doc(user.uid)
      .collection('records')
      .doc(docId)
      .set(payslipData);
    
    console.log('✅ Payslip and Breakdown saved to history:', docId, payslipData);
  } catch (error) {
    console.error('Error saving payslip to Firestore:', error);
    throw error;
  }
}

// --- Load Payslip History ---
async function loadPayslipHistory() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const snapshot = await db.collection('payslip_history')
      .doc(user.uid)
      .collection('records')
      .orderBy('generatedAt', 'desc')
      .get();

    payslipHistory = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log('📚 Loaded payslip history:', payslipHistory.length, 'records');
    
    renderPayslipHistory();
    updateHistoryCount();
    
  } catch (error) {
    console.error('Error loading payslip history:', error);
  }
}

// --- Update History Count Badge ---
function updateHistoryCount() {
  const historyCount = document.getElementById('historyCount');
  if (historyCount) {
    historyCount.textContent = payslipHistory.length;
    console.log('📊 History count updated:', payslipHistory.length);
  }
}

// --- Render Payslip History ---
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

// --- Download Payslip from History ---
window.downloadPayslipFromHistory = async function(docId, monthName, year, cutoff) {
  const user = auth.currentUser;
  if (!user) {
    alert('Please login to download payslip');
    return;
  }

  try {
    console.log('📥 Downloading payslip:', docId);
    
    const btn = event.target.closest('.btn-download-history');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    btn.disabled = true;

    const doc = await db.collection('payslip_history')
      .doc(user.uid)
      .collection('records')
      .doc(docId)
      .get();

    if (!doc.exists) {
      alert('Payslip not found');
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      return;
    }

    const data = doc.data();
    const pdfBase64 = data.pdfBase64;

    const binaryString = atob(pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payslip_${year}_${monthName}_Cutoff${cutoff}.pdf`;
    link.click();

    URL.revokeObjectURL(url);
    
    btn.innerHTML = originalHTML;
    btn.disabled = false;
    
    console.log('✅ Payslip downloaded successfully');
  } catch (error) {
    console.error('Error downloading payslip:', error);
    alert('Failed to download payslip. Please try again.');
  }
};

// --- Delete Payslip from History ---
window.deletePayslipFromHistory = async function(docId, periodName) {
  if (!confirm(`Are you sure you want to delete the payslip for ${periodName}?\n\nThis action cannot be undone.`)) {
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert('Please login to delete payslip');
    return;
  }

  try {
    console.log('🗑️ Deleting payslip:', docId);

    await db.collection('payslip_history')
      .doc(user.uid)
      .collection('records')
      .doc(docId)
      .delete();

    console.log('✅ Payslip deleted successfully');
    
    await loadPayslipHistory();
    updateHistoryCount();
    
    showToast('Payslip deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting payslip:', error);
    alert('Failed to delete payslip. Please try again.');
  }
};

// --- Show Toast Notification ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  
  const container = document.getElementById('toastContainer') || document.body;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Show Success Modal ---
function showSuccessModal() {
  const modal = document.getElementById('payslipSuccessModal');
  if (modal) {
    modal.classList.add('active');
  }
}

// --- Close Success Modal ---
async function closeSuccessModal() {
  document.getElementById('payslipSuccessModal').classList.remove('active');
  document.getElementById('generatePdfBtn').disabled = false;
  calculatedPayslip = null;
  
  // Clear preview values
  ['previewBasicPay','previewOvertimePay','previewNightDiff','previewHolidayPay',
   'previewGrossPay','previewSSS','previewPhilHealth','previewPagibig','previewBIRTax',
   'previewTotalDeductions','previewNetPay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = 'PHP 0.00';
  });
  
  // Reload saved rates and repopulate the rate input
  await loadSavedRates();
  populateRateInGenerate();
}