// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIza...",
    authDomain: "dutysync-12345.firebaseapp.com",
    projectId: "dutysync-12345",
    storageBucket: "dutysync-12345.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Sidebar & Hamburger
const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");

hamburger.addEventListener("click", () => sidebar.classList.toggle("open"));

// Close sidebar when clicking outside (mobile)
document.addEventListener("click", e => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        sidebar.classList.remove("open");
    }
});

// Remove open class on desktop resize
window.addEventListener("resize", () => {
    if (window.innerWidth > 768) sidebar.classList.remove("open");
});

// Navigation
const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".content-section");

// Navigation
navItems.forEach(item => {
    item.addEventListener("click", e => {
        e.preventDefault();

        const pageId = item.dataset.page;
        const parentId = item.dataset.parent;
        const isSub = item.classList.contains("sub-item");

        // Parent item with submenu
        if (parentId && !isSub) {
            const submenu = document.getElementById(`${parentId}-submenu`);
            submenu?.classList.toggle("expanded");
            item.classList.toggle("expanded");

            // Remove active from other parents
            navItems.forEach(nav => {
                if (!nav.classList.contains("sub-item") && nav !== item) {
                    nav.classList.remove("active");
                    const sub = document.getElementById(`${nav.dataset.parent}-submenu`);
                    sub?.classList.remove("expanded");
                    nav.classList.remove("expanded");
                }
            });

            // Set active for clicked parent
            item.classList.add("active");

            // Show parent section
            sections.forEach(sec => sec.classList.remove("active"));
            document.getElementById(pageId)?.classList.add("active");
        }

        // Sub-item or regular item without submenu
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

            // Collapse sidebar on mobile for sub-item or regular item
            if (window.innerWidth <= 768) sidebar.classList.remove("open");
        }
    });
});

// Form submission placeholder
document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", e => {
        e.preventDefault();
        alert("Form submitted! (Placeholder - integrate with Firebase)");
    });
});
