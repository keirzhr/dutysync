console.log("📚 Help section loaded");

// Tab Switching Logic
document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.help-tab-btn');
  const tabContents = document.querySelectorAll('.help-tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      document.getElementById(tabName).classList.add('active');

      console.log(`📑 Switched to tab: ${tabName}`);
    });
  });

  // FAQ Accordion Logic
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all other FAQs
      faqItems.forEach(faq => faq.classList.remove('active'));

      // Toggle current FAQ
      if (!isActive) {
        item.classList.add('active');
        console.log('❓ FAQ opened');
      } else {
        item.classList.remove('active');
        console.log('❓ FAQ closed');
      }
    });
  });

  // Smooth Scroll to Help Section
  window.scrollToHelp = function() {
    const helpSection = document.getElementById('help');
    if (helpSection) {
      helpSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  console.log('✅ Help section interactivity initialized');
});

// Add to your help.js or main.js file
document.addEventListener('DOMContentLoaded', () => {
  const contactBubble = document.getElementById('contactBubble');
  const contactPopup = document.getElementById('contactPopup');
  const popupClose = document.getElementById('popupClose');

  // Open popup
  contactBubble.addEventListener('click', () => {
    contactPopup.classList.add('active');
  });

  // Close popup
  popupClose.addEventListener('click', () => {
    contactPopup.classList.remove('active');
  });

  // Close on outside click
  contactPopup.addEventListener('click', (e) => {
    if (e.target === contactPopup) {
      contactPopup.classList.remove('active');
    }
  });
});