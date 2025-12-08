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

const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".content-section");
const updatePasswordBtn = document.getElementById('updatePasswordBtn');
const themeCheckbox = document.getElementById('themeCheckbox');

auth.onAuthStateChanged(async (user) => {
    if (user) {
        initializeNotifications();
        setupUserDataListener();
        setupDutyEntryListener();
        
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();

                user.lastKnownData = { ...userData };
                
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
                    const initials = userData.fullName 
                        ? userData.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                        : user.email.substring(0, 2).toUpperCase();
                    userAvatarElement.textContent = initials;
                }
            } else {
                document.getElementById('userEmail').textContent = user.email;
                document.getElementById('userName').textContent = user.email.split('@')[0];
                document.getElementById('userAvatar').textContent = user.email.substring(0, 2).toUpperCase();
            }
        } catch (error) {
            document.getElementById('userEmail').textContent = user.email;
            document.getElementById('userName').textContent = user.email.split('@')[0];
            document.getElementById('userAvatar').textContent = user.email.substring(0, 2).toUpperCase();
        }
    } else {
        window.location.href = '../index.html';
    }

    const dashboardParent = document.querySelector('[data-page="dashboard"]');
    const overviewItem = document.querySelector('[data-page="overview"]');

    dashboardParent.classList.add('active', 'expanded');
    const dashboardSubMenu = document.getElementById('dashboard-submenu');
    if (dashboardSubMenu) dashboardSubMenu.classList.add('expanded');

    overviewItem.classList.add('active');

    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    const overviewSection = document.getElementById('overview');
    if (overviewSection) overviewSection.classList.add('active');

    updateBreadcrumb('Dashboard', 'Overview');
});

function setupUserDataListener() {
  const user = auth.currentUser;
  if (!user) return;

  // Load last known data from sessionStorage
  const storedDataKey = `dutysync_lastKnownData_${user.uid}`;
  let lastKnownData = {};
  
  try {
    const stored = sessionStorage.getItem(storedDataKey);
    if (stored) {
      lastKnownData = JSON.parse(stored);
    }
  } catch (e) {
    // If parsing fails, start with empty object
    lastKnownData = {};
  }
  
  // Listen for user document changes
  db.collection('users').doc(user.uid).onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      
      // Check if this is the first load (sessionStorage was empty)
      const isFirstLoad = Object.keys(lastKnownData).length === 0;
      
      // Don't send notifications on first load after login/refresh
      if (!isFirstLoad) {
        // Check for profile photo changes
        if (lastKnownData.photoBase64 !== data.photoBase64) {
          if (data.photoBase64) {
            if (!lastKnownData.photoBase64) {
              addNotification('profile', 'Profile photo added');
            } else {
              addNotification('profile', 'Profile photo updated');
            }
          } else if (lastKnownData.photoBase64 && !data.photoBase64) {
            addNotification('profile', 'Profile photo removed');
          }
        }
        
        // Check for name changes
        if (lastKnownData.fullName && data.fullName !== lastKnownData.fullName) {
          addNotification('profile', `Name updated to ${data.fullName}`);
        }
        
        // Check for position changes
        if (lastKnownData.position && data.position !== lastKnownData.position) {
          addNotification('profile', `Position updated to ${data.position}`);
        }
        
        // Check for rate changes
        if (lastKnownData.hourlyRate !== data.hourlyRate) {
          addNotification('settings', `Hourly rate updated to ₱${data.hourlyRate || 0}`);
        }
        
        if (lastKnownData.dailyRate !== data.dailyRate) {
          addNotification('settings', `Daily rate updated to ₱${data.dailyRate || 0}`);
        }
        
        if (lastKnownData.overtimeMultiplier !== data.overtimeMultiplier) {
          addNotification('settings', `Overtime multiplier updated to ${data.overtimeMultiplier}x`);
        }
        
        if (lastKnownData.nightDiffMultiplier !== data.nightDiffMultiplier) {
          addNotification('settings', `Night differential updated to ${(data.nightDiffMultiplier * 100).toFixed(0)}%`);
        }
      }
      
      // Update sessionStorage with current data
      try {
        sessionStorage.setItem(storedDataKey, JSON.stringify(data));
      } catch (e) {
        // If sessionStorage fails, continue without storing
      }
      
      // Update the in-memory reference
      lastKnownData = { ...data };
    }
  });
}

function setupDutyEntryListener() {
  const user = auth.currentUser;
  if (!user) return;

  db.collection('duties')
    .where('user', '==', user.uid)
    .orderBy('date', 'desc')
    .limit(1)
    .onSnapshot((snapshot) => {
      if (!snapshot.empty) {
        const latestDuty = snapshot.docs[0].data();
        const dutyDate = new Date(latestDuty.date);
        const now = new Date();
        
        if (dutyDate.toDateString() === now.toDateString()) {
          addNotification('reminder', `Duty logged for ${dutyDate.toLocaleDateString()}: ${latestDuty.totalHours || 0} hours`);
        }
      }
    });
}

document.addEventListener("DOMContentLoaded", () => {
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
                showToast('Failed to logout: ' + error.message, 'error');
            }
        });
    }

    const themeCheckboxElement = document.getElementById('themeCheckbox');

    if (themeCheckboxElement) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeCheckboxElement.checked = true;

        themeCheckboxElement.addEventListener('change', () => {
            const theme = themeCheckboxElement.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
        });
    }
});

hamburger.addEventListener("click", () => sidebar.classList.toggle("open"));

document.addEventListener("click", e => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        sidebar.classList.remove("open");
    }
});

window.addEventListener("resize", () => {
    if (window.innerWidth > 768) sidebar.classList.remove("open");
});

function setHeights() {
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('.main-content');

    if (sidebar) sidebar.style.height = window.innerHeight + 'px';

    if (main) main.style.minHeight = window.innerHeight + 'px';
}

window.addEventListener('load', setHeights);
window.addEventListener('resize', setHeights);

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

navItems.forEach(item => {
    item.addEventListener("click", e => {
        e.preventDefault();
        const pageId = item.dataset.page;
        const parentId = item.dataset.parent;
        const isSub = item.classList.contains("sub-item");
        const itemText = item.querySelector('.nav-text')?.textContent || pageId;

        if (parentId && !isSub) {
            const submenu = document.getElementById(`${parentId}-submenu`);
            const isExpanded = item.classList.contains('expanded');

            navItems.forEach(nav => {
                if (!nav.classList.contains("sub-item") && nav !== item) {
                    nav.classList.remove('active', 'expanded');
                    const sub = document.getElementById(`${nav.dataset.parent}-submenu`);
                    if (sub) sub.classList.remove('expanded');
                }
            });

            item.classList.add('expanded');
            if (submenu) submenu.classList.add('expanded');

            item.classList.add("active");
            
            document.querySelectorAll(".sub-item").forEach(sub => sub.classList.remove("active"));
            
            const firstSubItem = submenu?.querySelector('.sub-item');
            if (firstSubItem) {
                firstSubItem.click();
            } else {
                updateBreadcrumb(itemText, '');
            }
            return;
        }

        if (isSub) {
            navItems.forEach(nav => nav.classList.remove("active"));
            
            item.classList.add("active");
            const navSection = item.closest('.nav-section');
            const parentItem = navSection?.querySelector('[data-parent]');
            if (parentItem) parentItem.classList.add("active", "expanded");
            
            const parentText = parentItem?.querySelector('.nav-text')?.textContent || 'Dashboard';
            
            updateBreadcrumb(parentText, itemText);
            
            sections.forEach(sec => sec.classList.remove("active"));
            if (document.getElementById(pageId)) {
                document.getElementById(pageId).classList.add("active");
            }
            
            if (window.innerWidth <= 768) sidebar.classList.remove("open");
            return;
        }

        if (!parentId && !isSub) {
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");
            
            updateBreadcrumb(itemText, '');
            
            sections.forEach(sec => sec.classList.remove("active"));
            if (document.getElementById(pageId)) {
                document.getElementById(pageId).classList.add("active");
            }
            
            if (window.innerWidth <= 768) sidebar.classList.remove("open");
            return;
        }
    });
});

let savedRates = { hourly: 0, daily: 0 };

function initializeRateSettings() {
  loadSavedRates();
  setupRateEventListeners();
}

function setupRateEventListeners() {
  const updateRateBtn = document.getElementById('updateRateBtn');
  if (updateRateBtn) {
    updateRateBtn.addEventListener('click', updateAndSaveRate);
  }
}

async function loadSavedRates() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      savedRates.hourly = data.hourlyRate || 0;
      savedRates.daily = data.dailyRate || 0;
      
      document.getElementById('hourlyRateInput').value = savedRates.hourly;
      document.getElementById('dailyRateInput').value = savedRates.daily;
      
      populateRateInGenerate();
    }
  } catch (error) {}
}

async function updateAndSaveRate() {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please login to update rates', 'error');
    return;
  }

  const hourlyRate = parseFloat(document.getElementById('hourlyRateInput').value) || 0;
  const dailyRate = parseFloat(document.getElementById('dailyRateInput').value) || 0;

  if (hourlyRate <= 0 && dailyRate <= 0) {
    showToast('Please enter at least one valid rate', 'error');
    return;
  }

  try {
    const updateBtn = document.getElementById('updateRateBtn');
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    updateBtn.disabled = true;

    await db.collection('users').doc(user.uid).update({
      hourlyRate: hourlyRate,
      dailyRate: dailyRate,
      rateUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    savedRates.hourly = hourlyRate;
    savedRates.daily = dailyRate;

    populateRateInGenerate();

    const statusMsg = document.getElementById('rateStatusMessage');
    statusMsg.textContent = 'Rates saved successfully!';
    statusMsg.style.display = 'block';
    statusMsg.style.color = '#10b981';

    updateBtn.innerHTML = '<i class="fas fa-save"></i> Save Rate';
    updateBtn.disabled = false;

    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3000);
  } catch (error) {
    showToast('Failed to save rates. Please try again.', 'error');
    
    const updateBtn = document.getElementById('updateRateBtn');
    updateBtn.innerHTML = '<i class="fas fa-save"></i> Save Rate';
    updateBtn.disabled = false;
  }
}

function populateRateInGenerate() {
  const rateInput = document.getElementById('rateInput');
  if (rateInput) {
    const rateValue = rateType === 'hourly' ? savedRates.hourly : savedRates.daily;
    rateInput.value = rateValue;
    rateInput.readOnly = true;
    rateInput.style.cursor = 'not-allowed';
    rateInput.style.opacity = '0.7';
  }
}

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

auth.onAuthStateChanged(async user => {
  if (user) {
    await loadEmployeeInfo(user);
    initializeGeneratePayslip();
    initializeRateSettings();
    initializePremiumRatesSettings();
    setupDutyUpdateListener();
    loadPayslipHistory();
  }
});

setupRateTypeChangeListener();

document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", e => {
        e.preventDefault();
        showToast('Form submitted!', 'info');
    });
});

updatePasswordBtn?.addEventListener('click', async () => {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    if (!currentPassword || !newPassword) return showToast('Please fill in both password fields', 'error');
    if (newPassword.length < 6) return showToast('New password must be at least 6 characters', 'error');

    try {
        const user = auth.currentUser;
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPassword);

        showToast('Password updated successfully!', 'success');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
    } catch (error) {
        showToast(error.code === 'auth/wrong-password' ? 'Current password is incorrect' : 'Failed to update password', 'error');
    }
});

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

const DEFAULT_RATES = {
  overtimeMultiplier: 1.25,
  nightDiffMultiplier: 0.10
};

let savedPremiumRates = {
  overtimeMultiplier: DEFAULT_RATES.overtimeMultiplier,
  nightDiffMultiplier: DEFAULT_RATES.nightDiffMultiplier
};

function initializePremiumRatesSettings() {
  loadSavedPremiumRates();
  setupPremiumRatesEventListeners();
}

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

async function loadSavedPremiumRates() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      
      savedPremiumRates.overtimeMultiplier = data.overtimeMultiplier !== undefined 
        ? data.overtimeMultiplier 
        : DEFAULT_RATES.overtimeMultiplier;
      
      savedPremiumRates.nightDiffMultiplier = data.nightDiffMultiplier !== undefined 
        ? data.nightDiffMultiplier 
        : DEFAULT_RATES.nightDiffMultiplier;
      
      document.getElementById('overtimeRateInput').value = savedPremiumRates.overtimeMultiplier;
      document.getElementById('nightDiffRateInput').value = savedPremiumRates.nightDiffMultiplier;
    } else {
      document.getElementById('overtimeRateInput').value = DEFAULT_RATES.overtimeMultiplier;
      document.getElementById('nightDiffRateInput').value = DEFAULT_RATES.nightDiffMultiplier;
    }
  } catch (error) {}
}

async function updateAndSavePremiumRates() {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please login to update premium rates', 'error');
    return;
  }

  const overtimeRate = parseFloat(document.getElementById('overtimeRateInput').value);
  const nightDiffRate = parseFloat(document.getElementById('nightDiffRateInput').value);

  if (isNaN(overtimeRate) || overtimeRate <= 0) {
    showToast('Please enter a valid overtime rate (e.g., 1.25)', 'error');
    return;
  }

  if (isNaN(nightDiffRate) || nightDiffRate < 0) {
    showToast('Please enter a valid night differential rate (e.g., 0.10)', 'error');
    return;
  }

  if (overtimeRate > 5) {
    showToast('Overtime rate seems too high. Please check your input.', 'error');
    return;
  }

  if (nightDiffRate > 1) {
    showToast('Night differential rate seems too high. Please check your input.', 'error');
    return;
  }

  try {
    const savePremiumBtn = document.getElementById('savePremiumRatesBtn');
    savePremiumBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    savePremiumBtn.disabled = true;

    await db.collection('users').doc(user.uid).update({
      overtimeMultiplier: overtimeRate,
      nightDiffMultiplier: nightDiffRate,
      premiumRatesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    savedPremiumRates.overtimeMultiplier = overtimeRate;
    savedPremiumRates.nightDiffMultiplier = nightDiffRate;

    const statusMsg = document.getElementById('premiumRatesStatusMessage');
    statusMsg.innerHTML = 'Premium rates saved successfully!';
    statusMsg.style.display = 'block';
    statusMsg.style.color = '#10b981';

    savePremiumBtn.innerHTML = '<i class="fas fa-save"></i> Save Premium Rates';
    savePremiumBtn.disabled = false;

    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3000);
  } catch (error) {
    showToast('Failed to save premium rates. Please try again.', 'error');
    
    const savePremiumBtn = document.getElementById('savePremiumRatesBtn');
    savePremiumBtn.innerHTML = '<i class="fas fa-save"></i> Save Premium Rates';
    savePremiumBtn.disabled = false;
  }
}

async function resetPremiumRatesToDefaults() {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please login to reset premium rates', 'error');
    return;
  }

  try {
    const resetBtn = document.getElementById('resetPremiumRatesBtn');
    resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
    resetBtn.disabled = true;

    await db.collection('users').doc(user.uid).update({
      overtimeMultiplier: DEFAULT_RATES.overtimeMultiplier,
      nightDiffMultiplier: DEFAULT_RATES.nightDiffMultiplier,
      premiumRatesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    savedPremiumRates.overtimeMultiplier = DEFAULT_RATES.overtimeMultiplier;
    savedPremiumRates.nightDiffMultiplier = DEFAULT_RATES.nightDiffMultiplier;

    document.getElementById('overtimeRateInput').value = DEFAULT_RATES.overtimeMultiplier;
    document.getElementById('nightDiffRateInput').value = DEFAULT_RATES.nightDiffMultiplier;

    const statusMsg = document.getElementById('premiumRatesStatusMessage');
    statusMsg.innerHTML = 'Premium rates reset to PH Labor Law defaults!';
    statusMsg.style.display = 'block';
    statusMsg.style.color = '#10b981';

    resetBtn.innerHTML = '<i class="fas fa-redo"></i> Reset to Defaults';
    resetBtn.disabled = false;

    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3000);
  } catch (error) {
    showToast('Failed to reset premium rates. Please try again.', 'error');
    
    const resetBtn = document.getElementById('resetPremiumRatesBtn');
    resetBtn.innerHTML = '<i class="fas fa-redo"></i> Reset to Defaults';
    resetBtn.disabled = false;
  }
}

async function deleteAccount() {
    const user = auth.currentUser;
    
    if (!user) {
        showToast('No user logged in.', 'error');
        return;
    }

    const doubleCheck = prompt("To confirm, please type 'DELETE' below:");

    if (doubleCheck !== 'DELETE') {
        showToast('Account deletion cancelled. Text did not match.', 'info');
        return;
    }

    try {
        const uid = user.uid;

        await db.collection('users').doc(uid).delete();

        await user.delete();

        localStorage.clear();
        showToast('Your account has been successfully deleted.', 'success');
        window.location.href = "../index.html";

    } catch (error) {
        if (error.code === 'auth/requires-recent-login') {
            showToast('Security measure: You must re-login before you can delete your account. Please logout, log back in, and try again.', 'warning');
        } else {
            showToast('Failed to delete account', 'error');
        }
    }
}

function enableEdit(section) {
    const fieldset = document.getElementById(`field-${section}`);
    fieldset.disabled = false;
    
    document.getElementById(`btns-${section}`).style.display = 'none';
    document.getElementById(`actions-${section}`).style.display = 'flex';
    
    const inputs = fieldset.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.style.borderColor = 'var(--primary-color)';
        input.style.paddingLeft = '10px';
        input.style.background = 'var(--hover-bg)';
    });
}

function cancelEdit(section) {
    const fieldset = document.getElementById(`field-${section}`);
    fieldset.disabled = true;
    
    document.getElementById(`btns-${section}`).style.display = 'block';
    document.getElementById(`actions-${section}`).style.display = 'none';
    
    const inputs = fieldset.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.style.borderColor = 'transparent';
        input.style.paddingLeft = '0';
        input.style.background = 'transparent';
    });
}

async function saveSection(section) {
    const user = auth.currentUser;
    if (!user) return;

    const statusMsg = document.getElementById('statusMessage');
    statusMsg.innerText = "Saving...";
    statusMsg.style.color = "var(--text-secondary)";

    let data = {};

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
        statusMsg.style.color = "#10b981";

        cancelEdit(section);

        setTimeout(() => statusMsg.innerText = "", 2000);

    } catch (error) {
        statusMsg.innerText = "Error saving.";
        statusMsg.style.color = "#ef4444";
    }
}

let notifications = [];

function initializeNotifications() {
  loadNotifications();
  setupNotificationListeners();
  checkDailyReminders();
}

function loadNotifications() {
  const saved = localStorage.getItem('dutysync_notifications');
  if (saved) {
    notifications = JSON.parse(saved);
    updateNotificationUI();
  }
}

function saveNotifications() {
  localStorage.setItem('dutysync_notifications', JSON.stringify(notifications));
  updateNotificationUI();
}

function addNotification(type, message) {
  const notification = {
    id: Date.now(),
    type: type,
    message: message,
    timestamp: new Date().toISOString(),
    read: false
  };
  
  notifications.unshift(notification);
  
  if (notifications.length > 20) {
    notifications = notifications.slice(0, 20);
  }
  
  saveNotifications();
}

function setupNotificationListeners() {
  const notifBtn = document.getElementById('notificationBtn');
  const notifDropdown = document.getElementById('notificationDropdown');
  const markAllRead = document.getElementById('markAllRead');
  const clearAllBtn = document.getElementById('clearAllBtn');
  
  if (notifBtn && notifDropdown) {
    notifBtn.replaceWith(notifBtn.cloneNode(true));
    const newNotifBtn = document.getElementById('notificationBtn');
    
    newNotifBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      
      notifDropdown.classList.toggle('active');
      
      if (notifDropdown.classList.contains('active')) {
        notifications.forEach(n => n.read = true);
        saveNotifications();
      }
    });
    
    document.addEventListener('click', function(e) {
      if (!notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
        notifDropdown.classList.remove('active');
      }
    });
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        notifDropdown.classList.remove('active');
      }
    });
  }
  
  if (markAllRead) {
    markAllRead.addEventListener('click', function() {
      notifications.forEach(n => n.read = true);
      saveNotifications();
      notifDropdown.classList.remove('active');
    });
  }
  
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', function() {
      notifications = [];
      saveNotifications();
      notifDropdown.classList.remove('active');
    });
  }
}

function updateNotificationUI() {
  const badge = document.getElementById('notificationBadge');
  const list = document.getElementById('notificationList');
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
  
  if (list) {
    if (notifications.length === 0) {
      list.innerHTML = `
        <div class="notification-empty">
          <i class="fas fa-bell-slash"></i>
          <p>No notifications</p>
        </div>
      `;
    } else {
      list.innerHTML = notifications.map(notif => {
        const iconClass = getNotificationIcon(notif.type);
        const timeAgo = getTimeAgo(notif.timestamp);
        
        return `
          <div class="notification-item ${notif.read ? '' : 'unread'}" onclick="markAsRead(${notif.id})">
            <div class="notification-icon ${notif.type}">
              <i class="${iconClass}"></i>
            </div>
            <div class="notification-content">
              <div class="notification-message">${notif.message}</div>
              <div class="notification-time">${timeAgo}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function getNotificationIcon(type) {
  const icons = {
    profile: 'fas fa-user-circle',
    settings: 'fas fa-cog',
    warning: 'fas fa-exclamation-triangle',
    reminder: 'fas fa-clock',
    cutoff: 'fas fa-calendar-check'
  };
  return icons[type] || 'fas fa-bell';
}

window.markAsRead = function(id) {
  const notif = notifications.find(n => n.id === id);
  if (notif) {
    notif.read = true;
    saveNotifications();
  }
};

function getTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
}

function checkDailyReminders() {
  const user = auth.currentUser;
  if (!user) return;
  
  const today = new Date();
  const dayOfMonth = today.getDate();
  
  if (dayOfMonth === 14) {
    addNotification('cutoff', 'Cutoff is tomorrow (15th) — make sure all duty logs are complete.');
  } else if (dayOfMonth === 30 || (dayOfMonth === 29 && today.getMonth() === 1)) {
    addNotification('cutoff', 'Cutoff is tomorrow — make sure all duty logs are complete.');
  }
  
  const lastCheck = localStorage.getItem('dutysync_last_hour_check');
  const todayStr = today.toDateString();
  
  if (lastCheck !== todayStr) {
    checkLowHours();
    localStorage.setItem('dutysync_last_hour_check', todayStr);
  }
}

async function checkLowHours() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const cutoff = day <= 15 ? 1 : 2;
    
    const snapshot = await db.collection('duties')
      .where('user', '==', user.uid)
      .get();
    
    let totalHours = 0;
    
    snapshot.forEach(doc => {
      const duty = doc.data();
      const [y, m, d] = duty.date.split('-').map(Number);
      if (y === year && m === month) {
        if (cutoff === 1 && d <= 15) {
          totalHours += duty.totalHours || 0;
        } else if (cutoff === 2 && d > 15) {
          totalHours += duty.totalHours || 0;
        }
      }
    });
    
    const expectedHours = 88;
    
    if (totalHours < expectedHours * 0.6 && day > 10 && day !== 15 && day < 25) {
      addNotification('warning', `Your total hours this cutoff (${totalHours.toFixed(1)} hrs) are lower than usual. Expected: ~${expectedHours} hrs.`);
    }
  } catch (error) {}
}

auth.onAuthStateChanged(async user => {
  if (user) {
    setTimeout(() => {
      initializeNotifications();
      
      const hasWelcome = localStorage.getItem('dutysync_welcome_shown');
      if (!hasWelcome) {
        addNotification('reminder', 'Welcome to DutySync! Start by setting your pay rates and logging your work hours.');
        localStorage.setItem('dutysync_welcome_shown', 'true');
      }
    }, 1000);
    
    db.collection('users').doc(user.uid).onSnapshot((doc) => {});
  }
});

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}