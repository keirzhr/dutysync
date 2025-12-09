let currentUserRates = {
  hourly: 0,
  daily: 0,
  overtime: 1.25,
  nightDiff: 0.10
};

auth.onAuthStateChanged(async user => {
  if (user) {
    loadUserSettings(user.uid);
    setupSettingsEventListeners();
  }
});

async function loadUserSettings(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      const data = userDoc.data();
      currentUserRates.hourly = data.hourlyRate || 0;
      currentUserRates.daily = data.dailyRate || 0;
      currentUserRates.overtime = data.overtimeMultiplier || 1.25;
      currentUserRates.nightDiff = data.nightDiffPercent || 10; // Stored as 10 (percentage)
      
      document.getElementById('hourlyRateInput').value = currentUserRates.hourly;
      document.getElementById('dailyRateInput').value = currentUserRates.daily;
      
      // Display as decimal with 2 decimal places
      document.getElementById('overtimeRateInput').value = parseFloat(currentUserRates.overtime).toFixed(2);
      document.getElementById('nightDiffRateInput').value = (currentUserRates.nightDiff / 100).toFixed(2); // Convert 10% to 0.10
    } else {
      setDefaultRates();
    }
  } catch (error) {
    showStatusMessage("Failed to load settings", "error");
  }
}

function setDefaultRates() {
  currentUserRates = {
    hourly: 0,
    daily: 0,
    overtime: 1.25,
    nightDiff: 0.10
  };
  
  // Use strings to preserve trailing zeros
  document.getElementById('overtimeRateInput').value = "1.25";
  document.getElementById('nightDiffRateInput').value = "0.10";
}

function validatePremiumRates() {
  const overtime = parseFloat(document.getElementById('overtimeRateInput').value) || 1.25;
  const nightDiff = parseFloat(document.getElementById('nightDiffRateInput').value) || 0.10;
  
  if (overtime < 1) {
    showPremiumStatusMessage("Overtime multiplier must be at least 1.0×", "error");
    return false;
  }
  
  if (nightDiff < 0 || nightDiff > 1) {
    showPremiumStatusMessage("Night differential must be between 0-1.0 (0-100%)", "error");
    return false;
  }
  
  return true;
}

async function savePremiumRates() {
  const user = auth.currentUser;
  if (!user) {
    showPremiumStatusMessage("Please login to save rates", "error");
    return;
  }
  
  if (!validatePremiumRates()) return;
  
  const overtime = parseFloat(document.getElementById('overtimeRateInput').value) || 1.25;
  const nightDiff = parseFloat(document.getElementById('nightDiffRateInput').value) || 0.10;
  
  try {
    const saveBtn = document.getElementById('savePremiumRatesBtn');
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;
    
    // Store nightDiff as percentage (0.10 becomes 10)
    const nightDiffPercent = nightDiff * 100;
    
    await db.collection('users').doc(user.uid).update({
      overtimeMultiplier: overtime,
      nightDiffPercent: nightDiffPercent,
      rateUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    currentUserRates.overtime = overtime;
    currentUserRates.nightDiff = nightDiffPercent; // Store as 10
    
    showPremiumStatusMessage("✅ Premium rates saved successfully!", "success");
    updateGeneratePayslipRates();
    
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    saveBtn.disabled = false;
  } catch (error) {
    showPremiumStatusMessage("Failed to save premium rates. Please try again.", "error");
    const saveBtn = document.getElementById('savePremiumRatesBtn');
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    saveBtn.disabled = false;
  }
}

function resetPremiumRates() {
  document.getElementById('overtimeRateInput').value = "1.25";
  document.getElementById('nightDiffRateInput').value = "0.10";
  showPremiumStatusMessage("Reset to defaults. Click 'Save' to confirm.", "warning");
}

function validateRates() {
  const hourly = parseFloat(document.getElementById('hourlyRateInput').value) || 0;
  const daily = parseFloat(document.getElementById('dailyRateInput').value) || 0;
  const overtime = parseFloat(document.getElementById('overtimeRateInput').value) || 1.25;
  const nightDiff = parseFloat(document.getElementById('nightDiffRateInput').value) || 0.10;
  
  if (hourly <= 0 && daily <= 0) {
    showStatusMessage("Please enter at least one base rate (hourly or daily)", "error");
    return false;
  }
  
  if (overtime < 1) {
    showStatusMessage("Overtime multiplier must be at least 1.0×", "error");
    return false;
  }
  
  if (nightDiff < 0 || nightDiff > 1) {
    showStatusMessage("Night differential must be between 0-1.0 (0-100%)", "error");
    return false;
  }
  
  return true;
}

async function saveRatesToFirestore() {
  const user = auth.currentUser;
  if (!user) {
    showStatusMessage("Please login to save rates", "error");
    return;
  }
  
  if (!validateRates()) return;
  
  const hourly = parseFloat(document.getElementById('hourlyRateInput').value) || 0;
  const daily = parseFloat(document.getElementById('dailyRateInput').value) || 0;
  const overtime = parseFloat(document.getElementById('overtimeRateInput').value) || 1.25;
  const nightDiff = parseFloat(document.getElementById('nightDiffRateInput').value) || 0.10;
  
  try {
    const updateBtn = document.getElementById('updateRateBtn');
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    updateBtn.disabled = true;
    
    // Store nightDiff as percentage (0.10 becomes 10)
    const nightDiffPercent = nightDiff * 100;
    
    await db.collection('users').doc(user.uid).update({
      hourlyRate: hourly,
      dailyRate: daily,
      overtimeMultiplier: overtime,
      nightDiffPercent: nightDiffPercent,
      rateUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    currentUserRates = { 
      hourly, 
      daily, 
      overtime, 
      nightDiff: nightDiffPercent // Store as 10
    };
    showStatusMessage("✅ Rates saved successfully!", "success");
    updateGeneratePayslipRates();
    
    updateBtn.innerHTML = '<i class="fas fa-save"></i> Save Base Rates';
    updateBtn.disabled = false;
  } catch (error) {
    showStatusMessage("Failed to save rates. Please try again.", "error");
    const updateBtn = document.getElementById('updateRateBtn');
    updateBtn.innerHTML = '<i class="fas fa-save"></i> Save Base Rates';
    updateBtn.disabled = false;
  }
}

function resetRatesToDefaults() {
  const deleteModal = document.getElementById('deleteConfirmModal');
  if (!deleteModal) {
    const confirmDelete = confirm("Reset overtime and night differential to defaults?\n\nOvertime: 1.25×\nNight Differential: 10%");
    if (!confirmDelete) return;
  } else {
    deleteModal.classList.add('active');
    document.getElementById('confirmDeleteBtn').onclick = () => {
      deleteModal.classList.remove('active');
      performRateReset();
    };
    document.getElementById('cancelDeleteBtn').onclick = () => deleteModal.classList.remove('active');
    return;
  }
  
  performRateReset();
}

function performRateReset() {
  document.getElementById('overtimeRateInput').value = "1.25";
  document.getElementById('nightDiffRateInput').value = "0.10";
  showStatusMessage("Reset to defaults. Click 'Save Rate Changes' to confirm.", "warning");
}

function updateGeneratePayslipRates() {
  if (typeof window.savedRates !== 'undefined') {
    window.savedRates.hourly = currentUserRates.hourly;
    window.savedRates.daily = currentUserRates.daily;
    window.savedRates.overtimeMultiplier = currentUserRates.overtime;
    window.savedRates.nightDiffPercent = currentUserRates.nightDiff;
    
    if (typeof populateRateInGenerate === 'function') {
      populateRateInGenerate();
    }
  }
}

function showStatusMessage(message, type = 'info') {
  const container = document.getElementById('rateStatusMessage');
  if (!container) return;
  
  container.className = `rate-status-message ${type}`;
  const icon = type === 'success' ? 'check-circle' : 
               type === 'error' ? 'exclamation-circle' : 
               'info-circle';
  
  container.innerHTML = `
    <div class="status-content">
      <i class="fas fa-${icon}"></i>
      <span>${message}</span>
    </div>
  `;
  
  container.style.display = 'flex';
  
  setTimeout(() => {
    container.style.display = 'none';
  }, 4000);
}

function showPremiumStatusMessage(message, type = 'info') {
  const container = document.getElementById('premiumRatesStatusMessage');
  if (!container) return;
  
  container.className = `rate-status-message ${type}`;
  const icon = type === 'success' ? 'check-circle' : 
               type === 'error' ? 'exclamation-circle' : 
               'info-circle';
  
  container.innerHTML = `
    <div class="status-content">
      <i class="fas fa-${icon}"></i>
      <span>${message}</span>
    </div>
  `;
  
  container.style.display = 'flex';
  
  setTimeout(() => {
    container.style.display = 'none';
  }, 4000);
}

confirmLogout.addEventListener('click', async () => {
    try {
        await auth.signOut();
        localStorage.removeItem('userSession');
      
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('dutysync_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
        
        window.location.href = "../index.html";
    } catch (error) {
        showToast('Failed to logout: ' + error.message, 'error');
    }
});

function setupSettingsEventListeners() {
  // Base rates button
  const saveBtn = document.getElementById('updateRateBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveRatesToFirestore);
  
  // Premium rates buttons
  const savePremiumBtn = document.getElementById('savePremiumRatesBtn');
  if (savePremiumBtn) savePremiumBtn.addEventListener('click', savePremiumRates);
  
  const resetPremiumBtn = document.getElementById('resetPremiumRatesBtn');
  if (resetPremiumBtn) resetPremiumBtn.addEventListener('click', resetPremiumRates);
  
  const resetBtn = document.getElementById('resetRatesBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetRatesToDefaults);
  
  const passwordBtn = document.getElementById('updatePasswordBtn');
  if (passwordBtn) passwordBtn.addEventListener('click', updatePassword);
  
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', openLogoutModal);
  
  setupTooltips();
}

function setupTooltips() {
  const tooltips = document.querySelectorAll('.tooltip-trigger');
  tooltips.forEach(tooltip => {
    tooltip.addEventListener('mouseenter', function() {});
  });
}

async function updatePassword() {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  
  if (!currentPassword || !newPassword) {
    showStatusMessage("Please fill in both password fields", "error");
    return;
  }
  
  if (newPassword.length < 6) {
    showStatusMessage("New password must be at least 6 characters", "error");
    return;
  }
  
  if (currentPassword === newPassword) {
    showStatusMessage("New password must be different from current password", "error");
    return;
  }
  
  try {
    const user = auth.currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    const btn = document.getElementById('updatePasswordBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    btn.disabled = true;
    
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
    
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    showStatusMessage("✅ Password updated successfully!", "success");
    
    btn.innerHTML = '<i class="fas fa-key"></i> Update Password';
    btn.disabled = false;
  } catch (error) {
    let message = "Failed to update password";
    if (error.code === 'auth/wrong-password') {
      message = "Current password is incorrect";
    } else if (error.code === 'auth/weak-password') {
      message = "Password is too weak";
    }
    
    showStatusMessage(message, "error");
    
    const btn = document.getElementById('updatePasswordBtn');
    btn.innerHTML = '<i class="fas fa-key"></i> Update Password';
    btn.disabled = false;
  }
}

function openLogoutModal() {
  const logoutModal = document.getElementById('logoutModal');
  if (logoutModal) logoutModal.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
  const confirmLogout = document.getElementById('confirmLogout');
  const cancelLogout = document.getElementById('cancelLogout');
  
  if (confirmLogout) {
    confirmLogout.addEventListener('click', async () => {
      try {
        await auth.signOut();
        localStorage.removeItem('userSession');
        window.location.href = '../index.html';
      } catch (error) {
        showStatusMessage("Failed to logout: " + error.message, "error");
      }
    });
  }
  
  if (cancelLogout) {
    cancelLogout.addEventListener('click', () => {
      const modal = document.getElementById('logoutModal');
      if (modal) modal.style.display = 'none';
    });
  }
});

window.getCurrentUserRates = function() {
  return { ...currentUserRates };
};