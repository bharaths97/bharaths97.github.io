document.addEventListener('DOMContentLoaded', function() {
  const toggleSwitch = document.getElementById('switch');
  const educationLabel = document.querySelector('.toggle-labels .education');
  const experienceLabel = document.querySelector('.toggle-labels .experience');
  const educationContent = document.getElementById('education-content');
  const experienceContent = document.getElementById('experience-content');

  // Set initial state
  toggleSwitch.checked = false;
  educationLabel.classList.add('active');
  experienceLabel.classList.remove('active');

  function toggleContent() {
    educationLabel.classList.toggle('active');
    experienceLabel.classList.toggle('active');
    educationContent.classList.toggle('active');
    experienceContent.classList.toggle('active');
  }

  toggleSwitch.addEventListener('change', toggleContent);

  educationLabel.addEventListener('click', function() {
    if (!educationContent.classList.contains('active')) {
      toggleSwitch.checked = false;
      toggleContent();
    }
  });

  experienceLabel.addEventListener('click', function() {
    if (!experienceContent.classList.contains('active')) {
      toggleSwitch.checked = true;
      toggleContent();
    }
  });
});