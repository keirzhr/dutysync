console.log("🔥 profile.js loaded");

// --- Global Variables ---
let currentUserData = null;
let isEditMode = false;

// --- Initialize Profile ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await loadUserProfile(user.uid);
        setupProfileEventListeners();
    }
});

// --- Load User Profile from Firestore ---
async function loadUserProfile(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            currentUserData = { id: userId, ...userDoc.data() };
            displayUserProfile(currentUserData);
            console.log("✅ Profile loaded successfully");
        } else {
            console.warn("⚠️ User document not found, creating default profile");
            const defaultProfile = {
                fullName: auth.currentUser.email.split('@')[0],
                email: auth.currentUser.email,
                phone: '',
                position: 'Manager',
                location: '',
                hireDate: new Date().toISOString().split('T')[0],
                photoURL: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(userId).set(defaultProfile);
            currentUserData = { id: userId, ...defaultProfile };
            displayUserProfile(currentUserData);
        }
    } catch (error) {
        console.error("❌ Error loading profile:", error);
        showToast("Failed to load profile data", "error");
    }
}

// --- Display User Profile ---
function displayUserProfile(userData) {
    const profileAvatarLarge = document.getElementById('profileAvatarLarge');
    
    if (profileAvatarLarge) {
        profileAvatarLarge.innerHTML = ''; // clear old content

        if (userData.photoBase64) {
            // Display uploaded Base64 photo
            const img = document.createElement('img');
            img.src = userData.photoBase64; // <-- must be Base64 string
            img.alt = 'Profile Photo';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            profileAvatarLarge.appendChild(img);
        } else {
            // Display initials if no photo
            const initials = userData.fullName 
                ? userData.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : userData.email.substring(0, 2).toUpperCase();
            profileAvatarLarge.textContent = initials;
        }
    }
    
    // Update header info
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePosition = document.getElementById('profilePosition');
    const profileStatus = document.getElementById('profileStatus');
    
    if (profileName) profileName.textContent = userData.fullName || 'No Name';
    if (profileEmail) profileEmail.textContent = userData.email || '';
    if (profilePosition) profilePosition.textContent = userData.position || 'Manager';
    if (profileStatus) profileStatus.textContent = 'Active';
    
    // Update form fields
    const profileFullName = document.getElementById('profileFullName');
    const profileEmailInput = document.getElementById('profileEmailInput');
    const profilePhone = document.getElementById('profilePhone');
    const profilePositionInput = document.getElementById('profilePositionInput');
    const profileLocation = document.getElementById('profileLocation');
    const profileHireDate = document.getElementById('profileHireDate');
    
    if (profileFullName) profileFullName.value = userData.fullName || '';
    if (profileEmailInput) profileEmailInput.value = userData.email || '';
    if (profilePhone) profilePhone.value = userData.phone || '';
    if (profilePositionInput) profilePositionInput.value = userData.position || '';
    if (profileLocation) profileLocation.value = userData.location || '';
    if (profileHireDate) profileHireDate.value = userData.hireDate || '';

    // --- Update Sidebar Footer ---
    const sidebarAvatar = document.getElementById('userAvatar');
    const sidebarName = document.getElementById('userName');
    const sidebarEmail = document.getElementById('userEmail');

    if (sidebarAvatar) {
        sidebarAvatar.innerHTML = '';
        if (userData.photoBase64) {
            const img = document.createElement('img');
            img.src = userData.photoBase64;
            img.alt = 'User Avatar';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            sidebarAvatar.appendChild(img);
        } else {
            const initials = userData.fullName 
                ? userData.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : userData.email.substring(0, 2).toUpperCase();
            sidebarAvatar.textContent = initials;
        }
    }

    if (sidebarName) sidebarName.textContent = userData.fullName || 'No Name';
    if (sidebarEmail) sidebarEmail.textContent = userData.email || '';
}


// --- Setup Event Listeners ---
function setupProfileEventListeners() {
    // Sidebar Footer Click - Navigate to Profile
    const sidebarFooterProfile = document.getElementById('sidebarFooterProfile');
    if (sidebarFooterProfile) {
        sidebarFooterProfile.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToProfile();
        });
    }
    
    // Avatar Edit Button
    const avatarEditBtn = document.getElementById('avatarEditBtn');
    if (avatarEditBtn) {
        avatarEditBtn.addEventListener('click', () => {
            document.getElementById('photoInput').click();
        });
    }
    
    // Photo Input Change
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoUpload);
    }
    
    // Edit Profile Button
    const btnEditProfile = document.getElementById('btnEditProfile');
    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', toggleEditMode);
    }
    
    // Cancel Button
    const btnCancelProfile = document.getElementById('btnCancelProfile');
    if (btnCancelProfile) {
        btnCancelProfile.addEventListener('click', cancelEditMode);
    }
    
    // Save Button
    const btnSaveProfile = document.getElementById('btnSaveProfile');
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener('click', saveProfileChanges);
    }
}

// --- Handle Photo Upload ---
async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast("Please select a valid image file", "error");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast("Image size must be less than 5MB", "error");
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        showToast("User not authenticated", "error");
        return;
    }

    try {
        const avatarEditBtn = document.getElementById('avatarEditBtn');
        const profileAvatarLarge = document.getElementById('profileAvatarLarge');

        avatarEditBtn.disabled = true;
        profileAvatarLarge.classList.add('loading');

        // Delete old photo if exists
        if (currentUserData.photoURL) {
            const oldPhotoRef = firebase.storage().refFromURL(currentUserData.photoURL);
            await oldPhotoRef.delete().catch(err => {
                console.warn("Old photo deletion failed:", err.message);
            });
        }

        // Upload new photo
        const timestamp = new Date().getTime();
        const fileName = `${user.uid}_${timestamp}`;
        const storageRef = firebase.storage().ref(`profiles/user-avatars/${user.uid}/${fileName}`);
        const snapshot = await storageRef.put(file);
        const photoURL = await snapshot.ref.getDownloadURL();

        // Update Firestore with new URL
        await db.collection('users').doc(user.uid).update({
            photoURL: photoURL,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        currentUserData.photoURL = photoURL;
        displayUserProfile(currentUserData);

        avatarEditBtn.disabled = false;
        profileAvatarLarge.classList.remove('loading');
        document.getElementById('photoInput').value = '';

        showToast("Photo uploaded successfully!", "success");
    } catch (error) {
        console.error("Error uploading photo:", error);
        avatarEditBtn.disabled = false;
        profileAvatarLarge.classList.remove('loading');
        document.getElementById('photoInput').value = '';
        showToast("Failed to upload photo: " + error.message, "error");
    }
}



// --- Navigate to Profile Section ---
function navigateToProfile() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const profileSection = document.getElementById('profile');
    if (profileSection) {
        profileSection.classList.add('active');
    }
    
    updateBreadcrumb('Profile', '');
    
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
    
    console.log("Navigated to Profile section");
}

// --- Toggle Edit Mode ---
function toggleEditMode() {
    isEditMode = true;
    
    const inputs = [
        'profileFullName',
        'profilePhone',
        'profilePositionInput',
        'profileLocation',
        'profileHireDate'
    ];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = false;
        }
    });
    
    const profileActions = document.getElementById('profileActions');
    if (profileActions) {
        profileActions.style.display = 'flex';
    }
    
    const profileActionsDefault = document.getElementById('profileActionsDefault');
    if (profileActionsDefault) {
        profileActionsDefault.style.display = 'none';
    }
    
    console.log("Edit mode enabled");
}

// --- Cancel Edit Mode ---
function cancelEditMode() {
    isEditMode = false;
    
    const inputs = document.querySelectorAll('.profile-input');
    inputs.forEach(input => {
        input.disabled = true;
    });
    
    const profileActions = document.getElementById('profileActions');
    if (profileActions) {
        profileActions.style.display = 'none';
    }
    
    const profileActionsDefault = document.getElementById('profileActionsDefault');
    if (profileActionsDefault) {
        profileActionsDefault.style.display = 'flex';
    }
    
    if (userData.photoBase64) {
        const img = document.createElement('img');
        img.src = userData.photoBase64;
        img.alt = 'Profile Photo';
        profileAvatarLarge.innerHTML = '';
        profileAvatarLarge.appendChild(img);
    } else {
        // fallback to initials
        const initials = userData.fullName 
            ? userData.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
            : userData.email.substring(0, 2).toUpperCase();
        profileAvatarLarge.textContent = initials;
    }

    
    console.log("Edit mode cancelled");
}

// --- Save Profile Changes ---
async function saveProfileChanges() {
    const user = auth.currentUser;
    if (!user) {
        showToast("User not authenticated", "error");
        return;
    }
    
    const fullName = document.getElementById('profileFullName').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();
    const position = document.getElementById('profilePositionInput').value.trim();
    const location = document.getElementById('profileLocation').value.trim();
    const hireDate = document.getElementById('profileHireDate').value;
    
    if (!fullName) {
        showToast("Full name is required", "error");
        return;
    }
    
    try {
        const updatedData = {
            fullName,
            phone,
            position,
            location,
            hireDate,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('users').doc(user.uid).update(updatedData);
        
        currentUserData = { ...currentUserData, ...updatedData };
        displayUserProfile(currentUserData);
        cancelEditMode();
        
        showToast("Profile updated successfully!", "success");
        console.log("✅ Profile saved successfully");
    } catch (error) {
        console.error("❌ Error saving profile:", error);
        showToast("Failed to save profile. Please try again.", "error");
    }
}

// --- Toast Notification ---
function showToast(message, type = "success") {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.warn("Toast container not found");
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' 
        ? '<i class="fas fa-check-circle toast-icon"></i>'
        : '<i class="fas fa-exclamation-circle toast-icon"></i>';
    
    toast.innerHTML = `
        ${icon}
        <span class="toast-message">${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// --- Update Breadcrumb Function ---
if (typeof updateBreadcrumb === 'undefined') {
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
}