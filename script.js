// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "dutysync-12345.firebaseapp.com",
    projectId: "dutysync-12345",
    storageBucket: "dutysync-12345.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
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
                window.location.href = "index.html";
            } catch (error) {
                console.error("Logout error:", error);
                alert("Failed to logout: " + error.message);
            }
        });
    }

    // --- Load and Toggle Theme (FIXED - No longer nested) ---
    const themeCheckboxElement = document.getElementById('themeCheckbox');
    
    if (themeCheckboxElement) {
        console.log('Theme checkbox found!'); // Debug log
        
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        console.log('Saved theme:', savedTheme); // Debug log
        
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeCheckboxElement.checked = savedTheme === 'dark';

        // Toggle theme
        themeCheckboxElement.addEventListener('change', () => {
            const theme = themeCheckboxElement.checked ? 'dark' : 'light';
            console.log('Switching to theme:', theme); // Debug log
            
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        });
    } else {
        console.error('Theme checkbox NOT found!'); // Debug log
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