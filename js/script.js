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
        console.log('Theme checkbox found!');
        
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        console.log('Saved theme:', savedTheme);
        
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeCheckboxElement.checked = savedTheme === 'dark';

        // Toggle theme
        themeCheckboxElement.addEventListener('change', () => {
            const theme = themeCheckboxElement.checked ? 'dark' : 'light';
            console.log('Switching to theme:', theme);
            
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
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

// --- Update Breadcrumb ---
function updateBreadcrumb(parentName, currentName) {
    const breadcrumbParent = document.getElementById('breadcrumbParent');
    const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    const breadcrumbSeparator = document.getElementById('breadcrumbSeparator');
    
    if (breadcrumbParent && breadcrumbCurrent && breadcrumbSeparator) {
        breadcrumbParent.textContent = parentName;
        breadcrumbCurrent.textContent = currentName;
        
        // Hide separator and current if no sub-page
        if (!currentName) {
            breadcrumbSeparator.style.display = 'none';
            breadcrumbCurrent.style.display = 'none';
        } else {
            breadcrumbSeparator.style.display = 'inline';
            breadcrumbCurrent.style.display = 'inline';
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

        if (parentId && !isSub) {
            const submenu = document.getElementById(`${parentId}-submenu`);
            const isExpanded = item.classList.contains('expanded');

            navItems.forEach(nav => {
                if (!nav.classList.contains("sub-item") && nav !== item) {
                    nav.classList.remove('active', 'expanded');
                    const sub = document.getElementById(`${nav.dataset.parent}-submenu`);
                    sub?.classList.remove('expanded');
                }
            });

            if (!isExpanded) {
                item.classList.add('expanded');
                submenu?.classList.add('expanded');
            }

            item.classList.add("active");
            sections.forEach(sec => sec.classList.remove("active"));
            document.getElementById(pageId)?.classList.add("active");
            
            // Update breadcrumb for parent items
            updateBreadcrumb(itemText, '');
        }

        if (isSub || !parentId) {
            if (isSub) {
                document.querySelectorAll(".sub-item").forEach(sub => sub.classList.remove("active"));
                item.classList.add("active");
                
                // Find parent name for breadcrumb
                const parentItem = item.closest('.nav-section')?.querySelector('[data-parent]');
                const parentText = parentItem?.querySelector('.nav-text')?.textContent || 'Dashboard';
                updateBreadcrumb(parentText, itemText);
            } else if (!parentId) {
                navItems.forEach(nav => nav.classList.remove("active"));
                item.classList.add("active");
                
                // Update breadcrumb for standalone items (Settings, Help)
                updateBreadcrumb(itemText, '');
            }

            sections.forEach(sec => sec.classList.remove("active"));
            document.getElementById(pageId)?.classList.add("active");

            if (window.innerWidth <= 768) sidebar.classList.remove("open");
        }
    });
});

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