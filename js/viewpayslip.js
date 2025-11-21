console.log("📄 viewpayslip.js loaded");

// Global variables
let allPayslips = [];
let currentPayslipUrl = null;
let currentPayslipFileName = null;

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

// Initialize on auth state change
auth.onAuthStateChanged(async user => {
    if (user) {
        await setupYearFilter(user.uid);
        setupAccordion();
    }
});

// Setup year filter with available years
async function setupYearFilter(userId) {
    try {
        // Get all available years from Firestore
        const snapshot = await db.collection('payslips')
            .where('userId', '==', userId)
            .get();

        const years = new Set();
        snapshot.docs.forEach(doc => {
            years.add(doc.data().year);
        });

        const sortedYears = Array.from(years).sort((a, b) => b - a);
        
        // Populate year filter
        const yearFilter = document.getElementById('payslipYearFilter');
        if (yearFilter) {
            yearFilter.innerHTML = '';
            sortedYears.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearFilter.appendChild(option);
            });

            // Set to first year (most recent)
            if (sortedYears.length > 0) {
                yearFilter.value = sortedYears[0];
                await loadPayslips(userId, sortedYears[0]);
            }

            // Listen for year changes
            yearFilter.addEventListener('change', async (e) => {
                await loadPayslips(userId, parseInt(e.target.value));
            });
        }
    } catch (error) {
        console.error("❌ Error setting up year filter:", error);
    }
}

// Setup accordion toggle
function setupAccordion() {
    document.querySelectorAll('.month-header').forEach(header => {
        header.addEventListener('click', () => {
            const month = header.closest('.accordion-month');
            const content = month.querySelector('.month-content');
            const toggle = header.querySelector('.month-toggle');

            header.classList.toggle('active');
            content.classList.toggle('active');
        });
    });
}

// Load payslips from Firestore
async function loadPayslips(userId, year) {
    try {
        console.log("🔍 Loading payslips for user:", userId, "year:", year);
        
        const snapshot = await db.collection('payslips')
            .where('userId', '==', userId)
            .where('year', '==', parseInt(year))
            .get();

        allPayslips = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log("✅ Payslips loaded:", allPayslips.length);
        console.log("📋 Payslips data:", allPayslips);
        updatePayslipAccordion();
        updateSalaryOverview();
    } catch (error) {
        console.error("❌ Error loading payslips:", error);
    }
}

// Update accordion with payslip data (only attachments and status)
function updatePayslipAccordion() {
    // Create a map of payslips by month and cutoff
    const payslipMap = {};
    allPayslips.forEach(ps => {
        const key = `${ps.month}_${ps.cutoff}`;
        payslipMap[key] = ps;
    });

    // Update each cutoff row
    document.querySelectorAll('.cutoff-row').forEach(row => {
        const month = parseInt(row.closest('.accordion-month').dataset.month);
        const cutoff = parseInt(row.dataset.cutoff);
        const key = `${month}_${cutoff}`;

        const payslip = payslipMap[key];

        // Get attachment and status cells
        const attachmentText = row.querySelector('.attachment-text');
        const statusBadge = row.querySelector('.status-badge');

        if (payslip) {
            // Update attachment
            if (payslip.fileName && payslip.filePath) {
                attachmentText.innerHTML = `<a class="attachment-link" onclick="downloadPayslip('${payslip.id}')">${payslip.fileName}</a>`;
            } else {
                attachmentText.textContent = 'None';
            }

            // Update status
            const statusClass = payslip.status === 'Done' ? 'status-done' : 'status-pending';
            statusBadge.className = `status-badge ${statusClass}`;
            statusBadge.textContent = payslip.status || 'Pending';
        } else {
            // No payslip, reset to default
            attachmentText.textContent = 'None';
            statusBadge.className = 'status-badge status-pending';
            statusBadge.textContent = 'Pending';
        }
    });
}

// Update salary overview (only values update)
function updateSalaryOverview() {
    // Create a map of salaries by month
    const monthlySalaries = {};
    allPayslips.forEach(ps => {
        const month = ps.month;
        const salary = ps.netPay || ps.grossPay || 0;
        
        if (!monthlySalaries[month]) {
            monthlySalaries[month] = 0;
        }
        monthlySalaries[month] += salary;
    });

    // Find max salary for progress bar calculation
    const maxSalary = Math.max(...Object.values(monthlySalaries), 1);
    let totalEarning = 0;

    // Update each salary item
    document.querySelectorAll('.salary-item').forEach(item => {
        const month = parseInt(item.dataset.month);
        const salary = monthlySalaries[month] || 0;
        totalEarning += salary;

        // Update amount
        const amountEl = item.querySelector('.salary-amount');
        amountEl.textContent = `₱${salary.toLocaleString('en-US', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

        // Update progress bar
        const percentage = salary > 0 ? (salary / maxSalary) * 100 : 0;
        const barEl = item.querySelector('.salary-bar');
        barEl.style.width = `${percentage}%`;
    });

    // Update total earning
    const totalEl = document.getElementById('totalEarning');
    if (totalEl) {
        totalEl.textContent = `₱${totalEarning.toLocaleString('en-US', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }
}

// Download payslip
async function downloadPayslip(payslipId) {
    try {
        const payslip = allPayslips.find(ps => ps.id === payslipId);
        if (!payslip || !payslip.filePath) {
            alert('File not found');
            return;
        }

        const storage = firebase.storage();
        const fileRef = storage.ref(payslip.filePath);
        const url = await fileRef.getDownloadURL();

        currentPayslipUrl = url;
        currentPayslipFileName = payslip.fileName || 'payslip.pdf';

        const modal = document.getElementById('payslipDownloadModal');
        const fileNameEl = document.getElementById('downloadFileName');

        fileNameEl.textContent = `${currentPayslipFileName}`;
        modal.classList.add('active');

        document.getElementById('confirmDownloadBtn').onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = currentPayslipFileName;
            a.click();
            closeDownloadModal();
        };

    } catch (error) {
        console.error("❌ Download error:", error);
        alert('Failed to download payslip. Please try again.');
    }
}

// Close download modal
function closeDownloadModal() {
    const modal = document.getElementById('payslipDownloadModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Close modals when clicking outside
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const downloadModal = document.getElementById('payslipDownloadModal');
        if (downloadModal && e.target === downloadModal) {
            closeDownloadModal();
        }
    });
});

// Update payslip status in Firestore (called from generate payslip)
window.updatePayslipStatus = async function(userId, year, month, cutoff, status, filePath, fileName) {
    try {
        const snapshot = await db.collection('payslips')
            .where('userId', '==', userId)
            .where('year', '==', year)
            .where('month', '==', month)
            .where('cutoff', '==', cutoff)
            .get();

        if (snapshot.docs.length > 0) {
            const docId = snapshot.docs[0].id;
            await db.collection('payslips').doc(docId).update({
                status: status,
                filePath: filePath,
                fileName: fileName,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Payslip status updated");
            const user = auth.currentUser;
            if (user) {
                const yearFilter = document.getElementById('payslipYearFilter');
                const selectedYear = yearFilter ? parseInt(yearFilter.value) : year;
                await loadPayslips(user.uid, selectedYear);
            }
        } else {
            console.warn("⚠️ Payslip record not found");
        }
    } catch (error) {
        console.error("❌ Error updating payslip status:", error);
    }
};

// Create payslip record in Firestore (called from generate payslip)
window.createPayslipRecord = async function(userId, year, month, cutoff, payslipData) {
    try {
        await db.collection('payslips').add({
            userId: userId,
            year: year,
            month: month,
            cutoff: cutoff,
            grossPay: payslipData.grossPay || 0,
            netPay: payslipData.netPay || 0,
            deductions: payslipData.deductions || {},
            status: 'Pending',
            filePath: null,
            fileName: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ Payslip record created");
    } catch (error) {
        console.error("❌ Error creating payslip record:", error);
    }
};