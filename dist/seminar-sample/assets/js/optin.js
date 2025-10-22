(function () {
  function pad(num) {
    return num.toString().padStart(2, '0');
  }

  function formatDuration(diff) {
    if (diff <= 0) {
      return '00:00:00';
    }
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = pad(hours);
    const mm = pad(minutes);
    const ss = pad(seconds);
    if (days > 0) {
      return days + '日 ' + hh + ':' + mm + ':' + ss;
    }
    return hh + ':' + mm + ':' + ss;
  }

  function initCountdown(el) {
    const deadline = el.getAttribute('data-deadline');
    if (!deadline) return;
    function update() {
      const diff = Date.parse(deadline) - Date.now();
      el.textContent = formatDuration(diff);
    }
    update();
    return window.setInterval(update, 1000);
  }

  function setupCountdowns() {
    const elements = document.querySelectorAll('[data-deadline]');
    const timers = [];
    elements.forEach((el) => {
      if (el.dataset.countdownInitialised) return;
      el.dataset.countdownInitialised = 'true';
      const timerId = initCountdown(el);
      if (timerId) timers.push(timerId);
    });
    return timers;
  }

  function setupStickyCTA() {
    const sticky = document.querySelector('.sticky-cta');
    if (!sticky) return;
    document.body.classList.add('has-sticky-cta');
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  onReady(function () {
    setupCountdowns();
    setupStickyCTA();
  });
})();
