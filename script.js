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
const themeSelector = document.getElementById('themeSelector');

// --- Theme ---
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeSelector) themeSelector.value = savedTheme;

    themeSelector?.addEventListener('change', e => {
        const theme = e.target.value;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    });
});

// --- Sidebar Toggle ---
hamburger.addEventListener("click", () => sidebar.classList.toggle("open"));

// --- Close sidebar on click outside (mobile only) ---
document.addEventListener("click", e => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        sidebar.classList.remove("open");
    }
});

// --- Remove open class on desktop resize ---
window.addEventListener("resize", () => {
    if (window.innerWidth > 768) sidebar.classList.remove("open");
});

// --- Navigation ---
navItems.forEach(item => {
    item.addEventListener("click", e => {
        e.preventDefault();
        const pageId = item.dataset.page;
        const parentId = item.dataset.parent;
        const isSub = item.classList.contains("sub-item");

        // --- Parent item with submenu ---
        if (parentId && !isSub) {
            const submenu = document.getElementById(`${parentId}-submenu`);
            const isExpanded = item.classList.contains('expanded');

            // Close all other submenus
            navItems.forEach(nav => {
                if (!nav.classList.contains("sub-item") && nav !== item) {
                    nav.classList.remove('active', 'expanded');
                    const sub = document.getElementById(`${nav.dataset.parent}-submenu`);
                    sub?.classList.remove('expanded');
                }
            });

            // Toggle current submenu
            if (!isExpanded) {
                item.classList.add('expanded');
                submenu?.classList.add('expanded');
            }

            // Set active for clicked parent
            item.classList.add("active");

            // Show parent section
            sections.forEach(sec => sec.classList.remove("active"));
            document.getElementById(pageId)?.classList.add("active");
        }

        // --- Sub-item or regular item without submenu ---
        if (isSub || !parentId) {
            if (isSub) {
                document.querySelectorAll(".sub-item").forEach(sub => sub.classList.remove("active"));
                item.classList.add("active");
            } else if (!parentId) {
                navItems.forEach(nav => nav.classList.remove("active"));
                item.classList.add("active");
            }

            sections.forEach(sec => sec.classList.remove("active"));
            document.getElementById(pageId)?.classList.add("active");

            // Collapse sidebar on mobile only
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
const updatePasswordBtn = document.getElementById('updatePasswordBtn');
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

// --- Logout ---
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", async e => {
    e.preventDefault();
    if (!confirm('Are you sure you want to logout?')) return;

    try {
        await auth.signOut();
        localStorage.removeItem('userSession');
        window.location.href = "index.html";
    } catch (error) {
        console.error("Logout error:", error);
        alert("Failed to logout: " + error.message);
    }
});
