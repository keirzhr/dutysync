console.log("📄 generate.js loaded");

// --- Global Variables ---
let rateType = 'hourly';
let calculatedPayslip = null;
let generatedPayslipUrl = null;
let employeeInfo = { name: '', position: '', email: '', initials: '--' };

// --- Initialize on Auth State Change ---
auth.onAuthStateChanged(async user => {
  if (user) {
    await loadEmployeeInfo(user);
    initializeGeneratePayslip();
    setupDutyUpdateListener(); // Listen for duty changes
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
    'generateEmployeeAvatar': employeeInfo.initials,
    'generateEmployeeName': employeeInfo.name,
    'generateEmployeePosition': employeeInfo.position,
    'generateEmployeeEmail': employeeInfo.email,
    'previewEmployeeName': employeeInfo.name,
    'previewEmployeePosition': employeeInfo.position,
    'previewEmployeeEmail': employeeInfo.email
  };
  
  Object.entries(els).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) {
      // Skip avatar elements, handle separately below
      if (!id.includes('Avatar')) {
        el.textContent = value;
      }
    }
  });

  // Update avatar displays
  updateAvatarDisplay();
}

// --- Update Avatar Display ---
function updateAvatarDisplay() {
  const generateEmployeeAvatar = document.getElementById('generateEmployeeAvatar');
  const previewEmployeeAvatar = document.getElementById('previewEmployeeAvatar');

  [generateEmployeeAvatar, previewEmployeeAvatar].forEach(avatar => {
    if (!avatar) return;
    
    avatar.innerHTML = '';
    
    if (employeeInfo.photoURL) {
      const img = document.createElement('img');
      img.src = employeeInfo.photoURL;
      img.alt = 'Employee Avatar';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '50%';
      avatar.appendChild(img);
    } else {
      avatar.textContent = employeeInfo.initials;
    }
  });
}

// --- Setup Duty Update Listener ---
function setupDutyUpdateListener() {
  const user = auth.currentUser;
  if (!user) return;

  // Listen for real-time changes in duties collection
  db.collection('duties')
    .where('user', '==', user.uid)
    .onSnapshot(() => {
      console.log('📡 Duty data changed, updating payslip preview...');
      fetchAndCalculateHours();
    }, error => {
      console.error('Error listening to duties:', error);
    });

  // Listen for profile photo updates
  db.collection('users').doc(user.uid).onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      employeeInfo.photoURL = data.photoURL || null;
      updateAvatarDisplay();
      console.log('📷 Profile photo updated');
    }
  }, error => {
    console.error('Error listening to profile:', error);
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

// --- Fetch Hours from Duty Logs ---
async function fetchAndCalculateHours() {
  const user = auth.currentUser;
  if (!user) return;

  const year = parseInt(document.getElementById('generateYear')?.value);
  const month = parseInt(document.getElementById('generateMonth')?.value);
  const cutoff = parseInt(document.getElementById('generateCutoff')?.value);

  try {
    const snapshot = await db.collection('duties').where('user', '==', user.uid).get();

    let regularHours = 0, overtimeHours = 0, nightHours = 0;
    let holidayHours = 0;
    let holidayPayAcc = 0;

    snapshot.forEach(doc => {
      const duty = doc.data();
      const [y, m, d] = duty.date.split('-').map(Number);

      if (y !== year || m !== month) return;
      if (cutoff === 1 && d > 15) return;
      if (cutoff === 2 && d <= 15) return;

      const hours = parseFloat(duty.hours) || 0;
      const overtime = parseFloat(duty.overTime) || 0;
      const dayType = duty.dayType || 'Regular';
      const compensationType = duty.compensationType || 'Regular Rate';

      // --- FIXED LOGIC START ---
      // We process Night Diff independently from Holiday so they can stack.

      const isHoliday = dayType.includes('Holiday') || dayType.includes('Special');
      const isNight = compensationType.toLowerCase().includes('night');

      // 1. Calculate Night Hours (For the 10% premium later)
      if (isNight) {
        nightHours += hours;
      }

      // 2. Calculate Base/Holiday Pay
      if (isHoliday) {
        holidayHours += hours; // For display stats
        // Accumulate weighted holiday hours
        if (dayType.includes('130')) {
           holidayPayAcc += hours * 1.30;
        } else if (dayType.includes('200')) {
           holidayPayAcc += hours * 2.00;
        } else {
           holidayPayAcc += hours * 1.30; // Fallback
        }
      } else {
        // If it is NOT a holiday, the base pay comes from Regular Hours.
        // Even if it is a Night Shift, the "Base" (100%) is counted here.
        regularHours += hours;
      }
      // --- FIXED LOGIC END ---

      overtimeHours += overtime;
    });

    const totalHours = regularHours + overtimeHours + nightHours + holidayHours;
    // Total worked is physical hours (excluding the double count of night diff overlap)
    // We approximate this by just summing the main buckets plus OT
    const totalWorked = regularHours + holidayHours + overtimeHours; 

    // Update summary display
    document.getElementById('summaryRegularHours').textContent = regularHours.toFixed(2);
    document.getElementById('summaryOvertimeHours').textContent = overtimeHours.toFixed(2);
    document.getElementById('summaryNightHours').textContent = nightHours.toFixed(2);
    document.getElementById('summaryHolidayHours').textContent = holidayHours.toFixed(2);
    document.getElementById('summaryWorkedHours').textContent = totalWorked.toFixed(2);

    console.log('📊 Hours calculated:', {
      regularHours,
      overtimeHours,
      nightHours,
      holidayHours,
      totalHours,
      totalWorked
    });

    window.fetchedHours = {
      regularHours,
      overtimeHours,
      nightHours,
      holidayHours,
      holidayPayAcc,
      totalHours,
      totalWorked
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

  const hours = window.fetchedHours || { regularHours: 0, overtimeHours: 0, nightHours: 0, holidayHours: 0, holidayPayAcc: 0 };
  const hourlyRate = rateType === 'daily' ? roundToDecimal(rate / 8, 4) : rate;

  const basicPay = roundToDecimal(hours.regularHours * hourlyRate, 2);
  const overtimePay = roundToDecimal(hours.overtimeHours * hourlyRate * 1.25, 2);
  
  // FIXED MATH: Changed multiplier to 0.10 (10% Premium)
  // Because the Base (100%) is already covered in 'regularHours' or 'holidayPay'
  const nightDiffPay = roundToDecimal(hours.nightHours * hourlyRate * 0.10, 2);
  
  const holidayPay = roundToDecimal(hours.holidayPayAcc * hourlyRate, 2);

  const grossPay = roundToDecimal(basicPay + overtimePay + nightDiffPay + holidayPay, 2);

  // --- Contributions (semi-monthly)
  const sssDeduction = roundToDecimal(calculateSSS(grossPay * 2) / 2, 2);
  const philhealthDeduction = roundToDecimal(calculatePhilHealth(grossPay * 2), 2);
  const pagibigDeduction = roundToDecimal(calculatePagibig(grossPay * 2) / 2, 2);

  const taxableIncome = roundToDecimal(grossPay - (sssDeduction + philhealthDeduction + pagibigDeduction), 2);
  const withholdingTax = calculateBIRWithholdingTax(taxableIncome);

  const totalDeductions = roundToDecimal(sssDeduction + philhealthDeduction + pagibigDeduction + withholdingTax, 2);
  const netPay = roundToDecimal(grossPay - totalDeductions, 2);

  // --- Update preview and calculatedPayslip
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
    employee: { ...employeeInfo }
  };

  document.getElementById('generatePdfBtn').disabled = false;
  console.log('✅ Payslip calculated:', calculatedPayslip);
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
// Semi-monthly thresholds: Annual PHP 250,000 = Monthly PHP 20,833 = Semi-monthly PHP 10,416.50
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

// --- Generate and Save Payslip ---
async function generateAndSavePayslip() {
  console.log('🚀 Generating payslip (Download Only)...');

  if (!calculatedPayslip) {
    alert('Please calculate payslip first');
    return;
  }

  const year = document.getElementById('generateYear').value;
  const month = document.getElementById('generateMonth').value;
  const cutoff = document.getElementById('generateCutoff').value;

  const monthNames = [
    'January','February','March','April','May','June','July',
    'August','September','October','November','December'
  ];
  const monthName = monthNames[month - 1];

  await loadJsPDF();
  const pdfBlob = createPdfPayslip(year, month, cutoff, monthName);
  const fileName = `Payslip_${monthName}-${year}_Cutoff${cutoff}.pdf`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(pdfBlob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);

}

// --- Create PDF Payslip ---
function createPdfPayslip(year, month, cutoff, monthName) {
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
  addRow('Overtime Pay (25% premium)', p.overtimePay);
  addRow('Night Differential (10% premium)', p.nightDiffPay);
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

  return doc.output('blob');
}

// --- Close Success Modal ---
function closeSuccessModal() {
  document.getElementById('payslipSuccessModal').classList.remove('active');
  document.getElementById('generatePdfBtn').disabled = false;
  calculatedPayslip = null;
  document.getElementById('rateInput').value = '';
  
  ['previewBasicPay','previewOvertimePay','previewNightDiff','previewHolidayPay',
   'previewGrossPay','previewSSS','previewPhilHealth','previewPagibig','previewBIRTax',
   'previewTotalDeductions','previewNetPay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = 'PHP 0.00';
  });
}