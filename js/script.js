// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyCqCMlZHHwScTBMrJr9QCOKMDYOasKX9JI",
    authDomain: "dutysync-2025.firebaseapp.com",
    projectId: "dutysync-2025",
    storageBucket: "dutysync-2025.appspot.com",
    messagingSenderId: "512248770067",
    appId: "1:512248770067:web:135e19274bf7e6c5bbd9e6",
    measurementId: "G-70X2MGERZC"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM Elements ---
const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".content-section");
const updatePasswordBtn = document.getElementById('updatePasswordBtn');
const themeCheckbox = document.getElementById('themeCheckbox');

// --- Check Authentication and Load User Data ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log('User logged in:', user.uid);
        
        // Fetch user data from Firestore
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // Update sidebar footer with user info
                const userNameElement = document.getElementById('userName');
                const userEmailElement = document.getElementById('userEmail');
                const userAvatarElement = document.getElementById('userAvatar');
                
                if (userNameElement) {
                    userNameElement.textContent = userData.fullName || 'User';
                }
                
                if (userEmailElement) {
                    userEmailElement.textContent = userData.email || user.email;
                }
                
                if (userAvatarElement) {
                    // Get first two letters of name for avatar
                    const initials = userData.fullName 
                        ? userData.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                        : user.email.substring(0, 2).toUpperCase();
                    userAvatarElement.textContent = initials;
                }
                
                console.log('User data loaded successfully');
            } else {
                console.log('No user document found in Firestore');
                // Fallback to auth email if no Firestore document
                document.getElementById('userEmail').textContent = user.email;
                document.getElementById('userName').textContent = user.email.split('@')[0];
                document.getElementById('userAvatar').textContent = user.email.substring(0, 2).toUpperCase();
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            // Fallback to auth email on error
            document.getElementById('userEmail').textContent = user.email;
            document.getElementById('userName').textContent = user.email.split('@')[0];
            document.getElementById('userAvatar').textContent = user.email.substring(0, 2).toUpperCase();
        }
    } else {
        // No user logged in, redirect to login
        console.log('No user logged in, redirecting...');
        window.location.href = '../index.html';
    }

    // Auto-select Dashboard -> Overview
const dashboardParent = document.querySelector('[data-page="dashboard"]');
const overviewItem = document.querySelector('[data-page="overview"]');

// Expand dashboard menu
dashboardParent.classList.add('active', 'expanded');
const dashboardSubMenu = document.getElementById('dashboard-submenu');
if (dashboardSubMenu) dashboardSubMenu.classList.add('expanded');

// Activate Overview sub-item
overviewItem.classList.add('active');

// Show Overview section
document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
const overviewSection = document.getElementById('overview');
if (overviewSection) overviewSection.classList.add('active');

// Update breadcrumb
updateBreadcrumb('Dashboard', 'Overview');

});

document.addEventListener("DOMContentLoaded", () => {
    // --- Logout Modal ---
    const logoutBtn = document.getElementById("logoutBtn");
    const logoutModal = document.getElementById("logoutModal");
    const confirmLogout = document.getElementById("confirmLogout");
    const cancelLogout = document.getElementById("cancelLogout");

    if (logoutBtn && logoutModal && confirmLogout && cancelLogout) {
        logoutBtn.addEventListener("click", () => {
            logoutModal.style.display = "flex";
        });

        cancelLogout.addEventListener("click", () => {
            logoutModal.style.display = "none";
        });

        confirmLogout.addEventListener("click", async () => {
            try {
                await auth.signOut();
                localStorage.removeItem('userSession');
                window.location.href = "../index.html";
            } catch (error) {
                console.error("Logout error:", error);
                alert("Failed to logout: " + error.message);
            }
        });
    }

    // --- Load and Toggle Theme ---
    const themeCheckboxElement = document.getElementById('themeCheckbox');

    if (themeCheckboxElement) {
        // Always default to dark
        document.documentElement.setAttribute('data-theme', 'dark');
        themeCheckboxElement.checked = true;

        // Toggle theme
        themeCheckboxElement.addEventListener('change', () => {
            const theme = themeCheckboxElement.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
        });
    } else {
        console.error('Theme checkbox NOT found!');
    }

});

// --- Sidebar Toggle ---
hamburger.addEventListener("click", () => sidebar.classList.toggle("open"));

// --- Close sidebar on click outside ---
document.addEventListener("click", e => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        sidebar.classList.remove("open");
    }
});

// --- Remove open class on desktop resize ---
window.addEventListener("resize", () => {
    if (window.innerWidth > 768) sidebar.classList.remove("open");
});

function setHeights() {
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('.main-content');

    // Set sidebar height
    if (sidebar) sidebar.style.height = window.innerHeight + 'px';

    // Set main content min-height to fill viewport
    if (main) main.style.minHeight = window.innerHeight + 'px';
}

// Run on page load
window.addEventListener('load', setHeights);

// Run on window resize
window.addEventListener('resize', setHeights);

// --- Update Breadcrumb ---
function updateBreadcrumb(parentName, currentName) {
    const breadcrumbParent = document.getElementById('breadcrumbParent');
    const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    
    if (breadcrumbParent) {
        breadcrumbParent.textContent = parentName;
    }
    
    if (breadcrumbCurrent) {
        if (currentName) {
            breadcrumbCurrent.textContent = currentName;
            breadcrumbCurrent.style.display = 'inline';
        } else {
            breadcrumbCurrent.textContent = '';
            breadcrumbCurrent.style.display = 'none';
        }
    }
}

// --- Navigation ---
navItems.forEach(item => {
    item.addEventListener("click", e => {
        e.preventDefault();
        const pageId = item.dataset.page;
        const parentId = item.dataset.parent;
        const isSub = item.classList.contains("sub-item");
        const itemText = item.querySelector('.nav-text')?.textContent || pageId;

        // Handle parent menu items with submenus
        if (parentId && !isSub) {
            const submenu = document.getElementById(`${parentId}-submenu`);
            const isExpanded = item.classList.contains('expanded');

            // Close other parent menus
            navItems.forEach(nav => {
                if (!nav.classList.contains("sub-item") && nav !== item) {
                    nav.classList.remove('active', 'expanded');
                    const sub = document.getElementById(`${nav.dataset.parent}-submenu`);
                    if (sub) sub.classList.remove('expanded');
                }
            });

            // Always expand the submenu
            item.classList.add('expanded');
            if (submenu) submenu.classList.add('expanded');

            item.classList.add("active");
            
            // Remove active from all sub-items
            document.querySelectorAll(".sub-item").forEach(sub => sub.classList.remove("active"));
            
            // Auto-click the first sub-item if it exists
            const firstSubItem = submenu?.querySelector('.sub-item');
            if (firstSubItem) {
                firstSubItem.click();
            } else {
                updateBreadcrumb(itemText, '');
            }
            return;
        }

        // Handle sub-items
        if (isSub) {
            // Remove active from all nav items
            navItems.forEach(nav => nav.classList.remove("active"));
            
            // Add active to both sub-item and parent
            item.classList.add("active");
            const navSection = item.closest('.nav-section');
            const parentItem = navSection?.querySelector('[data-parent]');
            if (parentItem) parentItem.classList.add("active", "expanded"); // <-- add hover/active effect
            
            const parentText = parentItem?.querySelector('.nav-text')?.textContent || 'Dashboard';
            
            updateBreadcrumb(parentText, itemText);
            
            // Show section
            sections.forEach(sec => sec.classList.remove("active"));
            if (document.getElementById(pageId)) {
                document.getElementById(pageId).classList.add("active");
            }
            
            if (window.innerWidth <= 768) sidebar.classList.remove("open");
            return;
        }


        // Handle standalone items (Settings, Help, etc.)
        if (!parentId && !isSub) {
            // Remove active from all nav items
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");
            
            updateBreadcrumb(itemText, '');
            
            // Show section
            sections.forEach(sec => sec.classList.remove("active"));
            if (document.getElementById(pageId)) {
                document.getElementById(pageId).classList.add("active");
            }
            
            if (window.innerWidth <= 768) sidebar.classList.remove("open");
            return;
        }
    });
});

// ========================================
// RATE UPDATE SYSTEM
// ========================================

let savedRates = { hourly: 0, daily: 0 };

// --- Initialize Rate Settings ---
function initializeRateSettings() {
  loadSavedRates();
  setupRateEventListeners();
}

// --- Setup Rate Event Listeners ---
function setupRateEventListeners() {
  const updateRateBtn = document.getElementById('updateRateBtn');
  if (updateRateBtn) {
    updateRateBtn.addEventListener('click', updateAndSaveRate);
  }
}

// --- Load Saved Rates from Firestore ---
async function loadSavedRates() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      savedRates.hourly = data.hourlyRate || 0;
      savedRates.daily = data.dailyRate || 0;
      
      // Populate settings inputs
      document.getElementById('hourlyRateInput').value = savedRates.hourly;
      document.getElementById('dailyRateInput').value = savedRates.daily;
      
      console.log('📊 Rates loaded from Firestore:', savedRates);
      
      // Auto-populate generate section
      populateRateInGenerate();
    }
  } catch (error) {
    console.error('Error loading rates:', error);
  }
}

// --- Update and Save Rate ---
async function updateAndSaveRate() {
  const user = auth.currentUser;
  if (!user) {
    alert('Please login to update rates');
    return;
  }

  const hourlyRate = parseFloat(document.getElementById('hourlyRateInput').value) || 0;
  const dailyRate = parseFloat(document.getElementById('dailyRateInput').value) || 0;

  if (hourlyRate <= 0 && dailyRate <= 0) {
    alert('Please enter at least one valid rate');
    return;
  }

  try {
    const updateBtn = document.getElementById('updateRateBtn');
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    updateBtn.disabled = true;

    // Save to Firestore
    await db.collection('users').doc(user.uid).update({
      hourlyRate: hourlyRate,
      dailyRate: dailyRate,
      rateUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update global variable
    savedRates.hourly = hourlyRate;
    savedRates.daily = dailyRate;

    // Populate generate section
    populateRateInGenerate();

    // Show success message
    const statusMsg = document.getElementById('rateStatusMessage');
    statusMsg.textContent = '✅ Rates saved successfully!';
    statusMsg.style.display = 'block';
    statusMsg.style.color = '#10b981';

    updateBtn.innerHTML = '<i class="fas fa-save"></i> Save Rate';
    updateBtn.disabled = false;

    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3000);

    console.log('✅ Rates updated:', { hourlyRate, dailyRate });
  } catch (error) {
    console.error('Error updating rates:', error);
    alert('Failed to save rates. Please try again.');
    
    const updateBtn = document.getElementById('updateRateBtn');
    updateBtn.innerHTML = '<i class="fas fa-save"></i> Save Rate';
    updateBtn.disabled = false;
  }
}

// --- Populate Rate in Generate Section (Read-Only) ---
function populateRateInGenerate() {
  const rateInput = document.getElementById('rateInput');
  if (rateInput) {
    // Determine which rate to use based on current rateType
    const rateValue = rateType === 'hourly' ? savedRates.hourly : savedRates.daily;
    rateInput.value = rateValue;
    rateInput.readOnly = true; // Make it read-only
    rateInput.style.cursor = 'not-allowed';
    rateInput.style.opacity = '0.7';
    
    console.log(`📌 Rate populated in generate section (${rateType}):`, rateValue);
  }
}

// --- Setup Listener for Rate Type Change ---
function setupRateTypeChangeListener() {
  const rateButtons = document.querySelectorAll('.rate-btn');
  rateButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        populateRateInGenerate();
      }, 100);
    });
  });
}

// --- Hook into existing generate.js initialization ---
// Call this after loadEmployeeInfo completes
auth.onAuthStateChanged(async user => {
  if (user) {
    await loadEmployeeInfo(user);
    initializeGeneratePayslip();
    initializeRateSettings(); // ADD THIS LINE
    initializePremiumRatesSettings();
    setupDutyUpdateListener();
    loadPayslipHistory();
  }
});

// Add this to setupEventListeners function in generate.js
// After the existing rate-btn event listeners:
setupRateTypeChangeListener();


// --- Form Submission Placeholder ---
document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", e => {
        e.preventDefault();
        alert("Form submitted! (Placeholder - integrate with Firebase)");
    });
});

// --- Update Password ---
updatePasswordBtn?.addEventListener('click', async () => {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    if (!currentPassword || !newPassword) return alert('Please fill in both password fields');
    if (newPassword.length < 6) return alert('New password must be at least 6 characters');

    try {
        const user = auth.currentUser;
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPassword);

        alert('Password updated successfully!');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
    } catch (error) {
        console.error('Password update error:', error);
        alert(error.code === 'auth/wrong-password' ? 'Current password is incorrect' : 'Failed to update password: ' + error.message);
    }
});

// --- About Modal ---
const aboutBtn = document.getElementById('aboutBtn');
const aboutModalOverlay = document.getElementById('aboutModalOverlay');
const aboutCloseBtn = document.getElementById('aboutCloseBtn');

function openAboutModal() {
  if (aboutModalOverlay) aboutModalOverlay.classList.add('active');
}

function closeAboutModal() {
  if (aboutModalOverlay) aboutModalOverlay.classList.remove('active');
}

if (aboutBtn) {
  aboutBtn.addEventListener('click', openAboutModal);
}

if (aboutCloseBtn) {
  aboutCloseBtn.addEventListener('click', closeAboutModal);
}

if (aboutModalOverlay) {
  aboutModalOverlay.addEventListener('click', (e) => {
    if (e.target === aboutModalOverlay) closeAboutModal();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAboutModal();
});

// ========================================
// PREMIUM RATES (OVERTIME & NIGHT DIFF)
// ========================================

// Default PH Labor Law Standards
const DEFAULT_RATES = {
  overtimeMultiplier: 1.25,      // 125% of base rate
  nightDiffMultiplier: 0.10      // 10% of base rate
};

let savedPremiumRates = {
  overtimeMultiplier: DEFAULT_RATES.overtimeMultiplier,
  nightDiffMultiplier: DEFAULT_RATES.nightDiffMultiplier
};

// --- Initialize Premium Rates Settings ---
function initializePremiumRatesSettings() {
  loadSavedPremiumRates();
  setupPremiumRatesEventListeners();
}

// --- Setup Premium Rates Event Listeners ---
function setupPremiumRatesEventListeners() {
  const savePremiumBtn = document.getElementById('savePremiumRatesBtn');
  const resetPremiumBtn = document.getElementById('resetPremiumRatesBtn');
  
  if (savePremiumBtn) {
    savePremiumBtn.addEventListener('click', updateAndSavePremiumRates);
  }
  
  if (resetPremiumBtn) {
    resetPremiumBtn.addEventListener('click', resetPremiumRatesToDefaults);
  }
}

// --- Load Saved Premium Rates from Firestore ---
async function loadSavedPremiumRates() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      
      // Load with fallback to defaults
      savedPremiumRates.overtimeMultiplier = data.overtimeMultiplier !== undefined 
        ? data.overtimeMultiplier 
        : DEFAULT_RATES.overtimeMultiplier;
      
      savedPremiumRates.nightDiffMultiplier = data.nightDiffMultiplier !== undefined 
        ? data.nightDiffMultiplier 
        : DEFAULT_RATES.nightDiffMultiplier;
      
      // Populate settings inputs
      document.getElementById('overtimeRateInput').value = savedPremiumRates.overtimeMultiplier;
      document.getElementById('nightDiffRateInput').value = savedPremiumRates.nightDiffMultiplier;
      
      console.log('✅ Premium rates loaded from Firestore:', savedPremiumRates);
    } else {
      // First time user - use defaults
      document.getElementById('overtimeRateInput').value = DEFAULT_RATES.overtimeMultiplier;
      document.getElementById('nightDiffRateInput').value = DEFAULT_RATES.nightDiffMultiplier;
      console.log('📊 Using default premium rates for new user');
    }
  } catch (error) {
    console.error('Error loading premium rates:', error);
  }
}

// --- Update and Save Premium Rates ---
async function updateAndSavePremiumRates() {
  const user = auth.currentUser;
  if (!user) {
    alert('Please login to update premium rates');
    return;
  }

  const overtimeRate = parseFloat(document.getElementById('overtimeRateInput').value);
  const nightDiffRate = parseFloat(document.getElementById('nightDiffRateInput').value);

  // Validation
  if (isNaN(overtimeRate) || overtimeRate <= 0) {
    alert('Please enter a valid overtime rate (e.g., 1.25)');
    return;
  }

  if (isNaN(nightDiffRate) || nightDiffRate < 0) {
    alert('Please enter a valid night differential rate (e.g., 0.10)');
    return;
  }

  if (overtimeRate > 5) {
    alert('Overtime rate seems too high. Please check your input.');
    return;
  }

  if (nightDiffRate > 1) {
    alert('Night differential rate seems too high. Please check your input.');
    return;
  }

  try {
    const savePremiumBtn = document.getElementById('savePremiumRatesBtn');
    savePremiumBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    savePremiumBtn.disabled = true;

    // Save to Firestore
    await db.collection('users').doc(user.uid).update({
      overtimeMultiplier: overtimeRate,
      nightDiffMultiplier: nightDiffRate,
      premiumRatesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update global variable
    savedPremiumRates.overtimeMultiplier = overtimeRate;
    savedPremiumRates.nightDiffMultiplier = nightDiffRate;

    // Show success message
    const statusMsg = document.getElementById('premiumRatesStatusMessage');
    statusMsg.innerHTML = '✅ Premium rates saved successfully!';
    statusMsg.style.display = 'block';
    statusMsg.style.color = '#10b981';

    savePremiumBtn.innerHTML = '<i class="fas fa-save"></i> Save Premium Rates';
    savePremiumBtn.disabled = false;

    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3000);

    console.log('✅ Premium rates updated:', { overtimeRate, nightDiffRate });
  } catch (error) {
    console.error('Error updating premium rates:', error);
    alert('Failed to save premium rates. Please try again.');
    
    const savePremiumBtn = document.getElementById('savePremiumRatesBtn');
    savePremiumBtn.innerHTML = '<i class="fas fa-save"></i> Save Premium Rates';
    savePremiumBtn.disabled = false;
  }
}

// --- Reset Premium Rates to Defaults ---
async function resetPremiumRatesToDefaults() {
  if (!confirm('Are you sure you want to reset premium rates to PH Labor Law defaults?\n\nOvertime: 1.25x\nNight Differential: 0.10x')) {
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert('Please login to reset premium rates');
    return;
  }

  try {
    const resetBtn = document.getElementById('resetPremiumRatesBtn');
    resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
    resetBtn.disabled = true;

    // Reset in Firestore
    await db.collection('users').doc(user.uid).update({
      overtimeMultiplier: DEFAULT_RATES.overtimeMultiplier,
      nightDiffMultiplier: DEFAULT_RATES.nightDiffMultiplier,
      premiumRatesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update global variable
    savedPremiumRates.overtimeMultiplier = DEFAULT_RATES.overtimeMultiplier;
    savedPremiumRates.nightDiffMultiplier = DEFAULT_RATES.nightDiffMultiplier;

    // Update inputs
    document.getElementById('overtimeRateInput').value = DEFAULT_RATES.overtimeMultiplier;
    document.getElementById('nightDiffRateInput').value = DEFAULT_RATES.nightDiffMultiplier;

    // Show success message
    const statusMsg = document.getElementById('premiumRatesStatusMessage');
    statusMsg.innerHTML = '✅ Premium rates reset to PH Labor Law defaults!';
    statusMsg.style.display = 'block';
    statusMsg.style.color = '#10b981';

    resetBtn.innerHTML = '<i class="fas fa-redo"></i> Reset to Defaults';
    resetBtn.disabled = false;

    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3000);

    console.log('✅ Premium rates reset to defaults:', DEFAULT_RATES);
  } catch (error) {
    console.error('Error resetting premium rates:', error);
    alert('Failed to reset premium rates. Please try again.');
    
    const resetBtn = document.getElementById('resetPremiumRatesBtn');
    resetBtn.innerHTML = '<i class="fas fa-redo"></i> Reset to Defaults';
    resetBtn.disabled = false;
  }
}

// --- Delete Account Function ---
async function deleteAccount() {
    const user = auth.currentUser;
    
    if (!user) {
        alert("No user logged in.");
        return;
    }

    // 1. Confirm Intent
    const confirmDelete = confirm(
        "⚠️ WARNING: Are you sure you want to delete your account?\n\n" +
        "This action is PERMANENT. All your data, settings, and payroll history will be erased forever."
    );

    if (!confirmDelete) return;

    // 2. Second Confirmation (Safety Check)
    const doubleCheck = prompt("To confirm, please type 'DELETE' below:");

    if (doubleCheck !== 'DELETE') {
        alert("Account deletion cancelled. Text did not match.");
        return;
    }

    try {
        const uid = user.uid;

        // 3. Delete User Data from Firestore
        // Note: If you have subcollections, you must delete them individually 
        // or rely on a Cloud Function. This deletes the main user doc.
        await db.collection('users').doc(uid).delete();
        console.log('User data deleted from Firestore');

        // 4. Delete Auth Account
        await user.delete();
        console.log('User account deleted');

        // 5. Cleanup and Redirect
        localStorage.clear();
        alert("Your account has been successfully deleted.");
        window.location.href = "../index.html";

    } catch (error) {
        console.error("Error deleting account:", error);

        // Handle "Requires Recent Login" error from Firebase
        if (error.code === 'auth/requires-recent-login') {
            alert("Security measure: You must re-login before you can delete your account. Please logout, log back in, and try again.");
            // Optional: Trigger logout here
        } else {
            alert("Failed to delete account: " + error.message);
        }
    }
}


// --- Payroll Edit Logic ---

// 1. Enable Edit Mode
function enableEdit(section) {
    const fieldset = document.getElementById(`field-${section}`);
    fieldset.disabled = false;
    
    // Show Action Buttons, Hide Edit Button
    document.getElementById(`btns-${section}`).style.display = 'none';
    document.getElementById(`actions-${section}`).style.display = 'flex';
    
    // Highlight inputs
    const inputs = fieldset.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.style.borderColor = 'var(--primary-color)';
        input.style.paddingLeft = '10px'; // Restore padding
        input.style.background = 'var(--hover-bg)';
    });
}

// 2. Cancel Edit Mode
function cancelEdit(section) {
    const fieldset = document.getElementById(`field-${section}`);
    fieldset.disabled = true;
    
    document.getElementById(`btns-${section}`).style.display = 'block';
    document.getElementById(`actions-${section}`).style.display = 'none';
    
    // Visual reset (optional: you might want to reload values from DB here)
    const inputs = fieldset.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.style.borderColor = 'transparent';
        input.style.paddingLeft = '0';
        input.style.background = 'transparent';
    });
}

// 3. Save Section
async function saveSection(section) {
    const user = auth.currentUser;
    if (!user) return;

    const statusMsg = document.getElementById('statusMessage');
    statusMsg.innerText = "Saving...";
    statusMsg.style.color = "var(--text-secondary)";

    let data = {};

    // Gather data based on section
    if (section === 'base') {
        data.hourlyRate = parseFloat(document.getElementById('hourlyRateInput').value) || 0;
        data.dailyRate = parseFloat(document.getElementById('dailyRateInput').value) || 0;
    } 
    else if (section === 'defaults') {
        data.defaultShiftHours = parseFloat(document.getElementById('defaultHoursInput').value) || 0;
        data.breakHours = parseFloat(document.getElementById('breakInput').value) || 0;
    } 
    else if (section === 'multipliers') {
        data.overtimeMultiplier = parseFloat(document.getElementById('overtimeRateInput').value) || 1.25;
        data.nightDiffMultiplier = parseFloat(document.getElementById('nightDiffRateInput').value) || 0.10;
    }

    try {
        await db.collection('users').doc(user.uid).update(data);
        
        statusMsg.innerText = "Saved!";
        statusMsg.style.color = "#10b981"; // Green

        // Lock inputs
        cancelEdit(section); 

        setTimeout(() => statusMsg.innerText = "", 2000);

    } catch (error) {
        console.error(error);
        statusMsg.innerText = "Error saving.";
        statusMsg.style.color = "#ef4444";
    }
}
