document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.help-tab-btn');
  const tabContents = document.querySelectorAll('.help-tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    });
  });

  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      faqItems.forEach(faq => faq.classList.remove('active'));

      if (!isActive) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  });

  window.scrollToHelp = function() {
    const helpSection = document.getElementById('help');
    if (helpSection) {
      helpSection.scrollIntoView({ behavior: 'smooth' });
    }
  };
});

document.addEventListener('DOMContentLoaded', () => {
  const contactBubble = document.getElementById('contactBubble');
  const contactPopup = document.getElementById('contactPopup');
  const popupClose = document.getElementById('popupClose');

  contactBubble.addEventListener('click', () => {
    contactPopup.classList.add('active');
  });

  popupClose.addEventListener('click', () => {
    contactPopup.classList.remove('active');
  });

  contactPopup.addEventListener('click', (e) => {
    if (e.target === contactPopup) {
      contactPopup.classList.remove('active');
    }
  });
});