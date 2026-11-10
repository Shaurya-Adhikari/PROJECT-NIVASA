// Runs before first paint: marks JS as available and applies the saved theme
document.documentElement.classList.add('js');
try {
  var t = localStorage.getItem('nivasa-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
