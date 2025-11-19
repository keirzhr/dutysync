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