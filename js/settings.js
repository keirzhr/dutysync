console.log("⚙️ Settings Section Loaded");

// ===== GLOBAL VARIABLES =====
let currentUserRates = {
  hourly: 0,
  daily: 0,
  overtime: 1.25,
  nightDiff: 10
};

// ===== INITIALIZE ON AUTH CHANGE =====
auth.onAuthStateChanged(async user => {
  if (user) {
    console.log("✅ User authenticated, loading settings...");
    loadUserSettings(user.uid);
    setupSettingsEventListeners();
  }
});

// ===== 1. LOAD USER SETTINGS FROM FIRESTORE =====
async function loadUserSettings(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      const data = userDoc.data();
      
      // Load rates
      currentUserRates.hourly = data.hourlyRate || 0;
      currentUserRates.daily = data.dailyRate || 0;
      currentUserRates.overtime = data.overtimeMultiplier || 1.25;
      currentUserRates.nightDiff = data.nightDiffPercent || 10;
      
      console.log("📊 Settings loaded from Firestore:", currentUserRates);
      
      // Populate UI with loaded values
      document.getElementById('hourlyRateInput').value = currentUserRates.hourly;
      document.getElementById('dailyRateInput').value = currentUserRates.daily;
      document.getElementById('overtimeMultiplierInput').value = currentUserRates.overtime;
      document.getElementById('nightDiffPercentInput').value = currentUserRates.nightDiff;
      
    } else {
      console.log("⚠️ No user document found, using defaults");
      setDefaultRates();
    }
  } catch (error) {
    console.error("❌ Error loading settings:", error);
    showStatusMessage("Failed to load settings", "error");
  }
}

// ===== 2. SET DEFAULT RATES =====
function setDefaultRates() {
  currentUserRates = {
    hourly: 0,
    daily: 0,
    overtime: 1.25,
    nightDiff: 10
  };
  
  document.getElementById('overtimeMultiplierInput').value = 1.25;
  document.getElementById('nightDiffPercentInput').value = 10;
  
  console.log("✅ Default rates set");
}

// ===== 3. VALIDATE RATES =====
function validateRates() {
  const hourly = parseFloat(document.getElementById('hourlyRateInput').value) || 0;
  const daily = parseFloat(document.getElementById('dailyRateInput').value) || 0;
  const overtime = parseFloat(document.getElementById('overtimeMultiplierInput').value) || 1.25;
  const nightDiff = parseFloat(document.getElementById('nightDiffPercentInput').value) || 10;
  
  // At least one base rate must be entered
  if (hourly <= 0 && daily <= 0) {
    showStatusMessage("Please enter at least one base rate (hourly or daily)", "error");
    return false;
  }
  
  // Overtime must be >= 1
  if (overtime < 1) {
    showStatusMessage("Overtime multiplier must be at least 1.0×", "error");
    return false;
  }
  
  // Night diff must be 0-100%
  if (nightDiff < 0 || nightDiff > 100) {
    showStatusMessage("Night differential must be between 0-100%", "error");
    return false;
  }
  
  return true;
}

// ===== 4. SAVE RATES TO FIRESTORE =====
async function saveRatesToFirestore() {
  const user = auth.currentUser;
  if (!user) {
    showStatusMessage("Please login to save rates", "error");
    return;
  }
  
  // Validate first
  if (!validateRates()) return;
  
  const hourly = parseFloat(document.getElementById('hourlyRateInput').value) || 0;
  const daily = parseFloat(document.getElementById('dailyRateInput').value) || 0;
  const overtime = parseFloat(document.getElementById('overtimeMultiplierInput').value) || 1.25;
  const nightDiff = parseFloat(document.getElementById('nightDiffPercentInput').value) || 10;
  
  try {
    const updateBtn = document.getElementById('updateRateBtn');
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    updateBtn.disabled = true;
    
    // Update Firestore
    await db.collection('users').doc(user.uid).update({
      hourlyRate: hourly,
      dailyRate: daily,
      overtimeMultiplier: overtime,
      nightDiffPercent: nightDiff,
      rateUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update global variable
    currentUserRates = { hourly, daily, overtime, nightDiff };
    
    console.log("✅ Rates saved to Firestore:", currentUserRates);
    showStatusMessage("✅ Rates saved successfully!", "success");
    
    // Update generate payslip section if it exists
    updateGeneratePayslipRates();
    
    updateBtn.innerHTML = '<i class="fas fa-save"></i> Save Rate Changes';
    updateBtn.disabled = false;
    
  } catch (error) {
    console.error("❌ Error saving rates:", error);
    showStatusMessage("Failed to save rates. Please try again.", "error");
    
    const updateBtn = document.getElementById('updateRateBtn');
    updateBtn.innerHTML = '<i class="fas fa-save"></i> Save Rate Changes';
    updateBtn.disabled = false;
  }
}

// ===== 5. RESET RATES TO DEFAULTS =====
function resetRatesToDefaults() {
  if (!confirm("Reset overtime and night differential to defaults?\n\nOvertime: 1.25×\nNight Differential: 10%")) {
    return;
  }
  
  document.getElementById('overtimeMultiplierInput').value = 1.25;
  document.getElementById('nightDiffPercentInput').value = 10;
  
  showStatusMessage("⚠️ Reset to defaults. Click 'Save Rate Changes' to confirm.", "warning");
  console.log("🔄 Reset to defaults pending confirmation");
}

// ===== 6. UPDATE GENERATE PAYSLIP RATES =====
function updateGeneratePayslipRates() {
  // This function updates the rate in the generate payslip section
  // It communicates with generate.js through the global savedRates variable
  if (typeof window.savedRates !== 'undefined') {
    window.savedRates.hourly = currentUserRates.hourly;
    window.savedRates.daily = currentUserRates.daily;
    window.savedRates.overtimeMultiplier = currentUserRates.overtime;
    window.savedRates.nightDiffPercent = currentUserRates.nightDiff;
    
    console.log("✅ Generate payslip rates updated");
    
    // Refresh the rate input in generate section
    if (typeof populateRateInGenerate === 'function') {
      populateRateInGenerate();
    }
  }
}

// ===== 7. SHOW STATUS MESSAGE =====
function showStatusMessage(message, type = 'info') {
  const container = document.getElementById('rateStatusMessage');
  if (!container) return;
  
  container.className = `rate-status-message ${type}`;
  
  const statusText = message;
  const icon = type === 'success' ? 'check-circle' : 
               type === 'error' ? 'exclamation-circle' : 
               'info-circle';
  
  container.innerHTML = `
    <div class="status-content">
      <i class="fas fa-${icon}"></i>
      <span>${statusText}</span>
    </div>
  `;
  
  container.style.display = 'flex';
  
  // Auto-hide after 4 seconds
  setTimeout(() => {
    container.style.display = 'none';
  }, 4000);
}

// ===== 8. SETUP EVENT LISTENERS =====
function setupSettingsEventListeners() {
  // Save Rate Button
  const saveBtn = document.getElementById('updateRateBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveRatesToFirestore);
  }
  
  // Reset Rates Button
  const resetBtn = document.getElementById('resetRatesBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetRatesToDefaults);
  }
  
  // Update Password Button
  const passwordBtn = document.getElementById('updatePasswordBtn');
  if (passwordBtn) {
    passwordBtn.addEventListener('click', updatePassword);
  }
  
  // Logout Button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', openLogoutModal);
  }
  
  // Tooltip functionality
  setupTooltips();
}

// ===== 9. TOOLTIP SETUP =====
function setupTooltips() {
  const tooltips = document.querySelectorAll('.tooltip-trigger');
  tooltips.forEach(tooltip => {
    tooltip.addEventListener('mouseenter', function() {
      // Tooltip is shown via CSS ::before and ::after
    });
  });
}

// ===== 10. UPDATE PASSWORD =====
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
    
    // Reauthenticate
    await user.reauthenticateWithCredential(credential);
    
    // Update password
    await user.updatePassword(newPassword);
    
    // Clear inputs
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    
    showStatusMessage("✅ Password updated successfully!", "success");
    
    btn.innerHTML = '<i class="fas fa-key"></i> Update Password';
    btn.disabled = false;
    
    console.log("✅ Password updated");
    
  } catch (error) {
    console.error("❌ Password update error:", error);
    
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

// ===== 11. LOGOUT FUNCTIONALITY =====
async function openLogoutModal() {
  const logoutModal = document.getElementById('logoutModal');
  if (logoutModal) {
    logoutModal.style.display = 'flex';
  }
}

// Make logout modal buttons work
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
        console.error("Logout error:", error);
        showStatusMessage("Failed to logout: " + error.message, "error");
      }
    });
  }
  
  if (cancelLogout) {
    cancelLogout.addEventListener('click', () => {
      const modal = document.getElementById('logoutModal');
      if (modal) {
        modal.style.display = 'none';
      }
    });
  }
});

// ===== EXPORT RATES (For use in other modules) =====
window.getCurrentUserRates = function() {
  return { ...currentUserRates };
};