// profile.js
let currentUserData = null;
let isEditMode = false;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        await loadUserProfile(user.uid);
        setupProfileEventListeners();
    }
});

async function loadUserProfile(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            currentUserData = { id: userId, ...userDoc.data() };
            displayUserProfile(currentUserData);
        } else {
            const defaultProfile = {
                fullName: auth.currentUser.email.split('@')[0],
                email: auth.currentUser.email,
                phone: '',
                position: '',
                address: '',
                hireDate: new Date().toISOString().split('T')[0],
                photoBase64: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(userId).set(defaultProfile);
            currentUserData = { id: userId, ...defaultProfile };
            displayUserProfile(currentUserData);
        }
    } catch (error) {
        showToast("Failed to load profile data", "error");
    }
}

function displayUserProfile(userData) {
    const profileAvatarLarge = document.getElementById('profileAvatarLarge');
    
    if (profileAvatarLarge) {
        profileAvatarLarge.innerHTML = '';
        
        if (userData.photoBase64) {
            const img = document.createElement('img');
            img.src = userData.photoBase64;
            img.alt = 'Profile Photo';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            profileAvatarLarge.appendChild(img);
        } else {
            const initials = userData.fullName 
                ? userData.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : userData.email.substring(0, 2).toUpperCase();
            profileAvatarLarge.textContent = initials;
        }
    }
    
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePosition = document.getElementById('profilePosition');
    const profileStatus = document.getElementById('profileStatus');
    
    if (profileName) profileName.textContent = userData.fullName || 'No Name';
    if (profileEmail) profileEmail.textContent = userData.email || '';
    if (profilePosition) profilePosition.textContent = userData.position || 'Manager';
    if (profileStatus) profileStatus.textContent = 'Active';
    
    const profileFullName = document.getElementById('profileFullName');
    const profileEmailInput = document.getElementById('profileEmailInput');
    const profilePhone = document.getElementById('profilePhone');
    const profilePositionInput = document.getElementById('profilePositionInput');
    const profileAddress = document.getElementById('profileAddress');
    const profileHireDate = document.getElementById('profileHireDate');
    
    if (profileFullName) profileFullName.value = userData.fullName || '';
    if (profileEmailInput) profileEmailInput.value = userData.email || '';
    if (profilePhone) profilePhone.value = userData.phone || '';
    if (profilePositionInput) profilePositionInput.value = userData.position || '';
    if (profileAddress) profileAddress.value = userData.address || '';
    if (profileHireDate) profileHireDate.value = userData.hireDate || '';

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

function setupProfileEventListeners() {
    const sidebarFooterProfile = document.getElementById('sidebarFooterProfile');
    if (sidebarFooterProfile) {
        sidebarFooterProfile.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToProfile();
        });
    }
    
    const avatarEditBtn = document.getElementById('avatarEditBtn');
    if (avatarEditBtn) {
        avatarEditBtn.addEventListener('click', () => {
            document.getElementById('photoInput').click();
        });
    }
    
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoUpload);
    }
    
    const btnEditProfile = document.getElementById('btnEditProfile');
    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', toggleEditMode);
    }
    
    const btnCancelProfile = document.getElementById('btnCancelProfile');
    if (btnCancelProfile) {
        btnCancelProfile.addEventListener('click', cancelEditMode);
    }
    
    const btnSaveProfile = document.getElementById('btnSaveProfile');
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener('click', saveProfileChanges);
    }
}

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

        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                const base64String = event.target.result;

                await db.collection('users').doc(user.uid).update({
                    photoBase64: base64String,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                currentUserData.photoBase64 = base64String;
                displayUserProfile(currentUserData);

                avatarEditBtn.disabled = false;
                profileAvatarLarge.classList.remove('loading');
                document.getElementById('photoInput').value = '';

                showToast("Photo uploaded successfully!", "success");
            } catch (error) {
                avatarEditBtn.disabled = false;
                profileAvatarLarge.classList.remove('loading');
                document.getElementById('photoInput').value = '';
                showToast("Failed to save photo: " + error.message, "error");
            }
        };

        reader.onerror = () => {
            avatarEditBtn.disabled = false;
            profileAvatarLarge.classList.remove('loading');
            document.getElementById('photoInput').value = '';
            showToast("Failed to read image file", "error");
        };

        reader.readAsDataURL(file);
    } catch (error) {
        const avatarEditBtn = document.getElementById('avatarEditBtn');
        const profileAvatarLarge = document.getElementById('profileAvatarLarge');
        avatarEditBtn.disabled = false;
        profileAvatarLarge.classList.remove('loading');
        document.getElementById('photoInput').value = '';
        showToast("Failed to upload photo: " + error.message, "error");
    }
}

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
}

function toggleEditMode() {
    isEditMode = true;
    
    const inputs = [
        'profileFullName',
        'profilePhone',
        'profilePositionInput',
        'profileAddress',
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
}

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

    displayUserProfile(currentUserData);
}

async function saveProfileChanges() {
    const user = auth.currentUser;
    if (!user) {
        showToast("User not authenticated", "error");
        return;
    }
    
    const fullName = document.getElementById('profileFullName').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();
    const position = document.getElementById('profilePositionInput').value.trim();
    const address = document.getElementById('profileAddress').value.trim();
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
            address,
            hireDate,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('users').doc(user.uid).update(updatedData);
        
        currentUserData = { ...currentUserData, ...updatedData };
        displayUserProfile(currentUserData);
        cancelEditMode();
        
        showToast("Profile updated successfully!", "success");
    } catch (error) {
        showToast("Failed to save profile. Please try again.", "error");
    }
}

function showToast(message, type = "success") {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
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