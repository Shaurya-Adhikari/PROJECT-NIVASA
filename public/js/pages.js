// NIVASA — info pages: feedback form (About) and account deletion (Privacy).
(function () {
  'use strict';

  const api = window.nivasaApi;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Feedback (saved in a JSON file on the server) ----------
  const form = document.querySelector('[data-feedback-form]');
  if (form) {
    const list = document.querySelector('[data-feedback-list]');
    const summary = document.querySelector('[data-feedback-summary]');
    const status = form.querySelector('[data-feedback-status]');
    const msgError = form.querySelector('[data-error-for="message"]');

    // GET /api/feedback → show the latest entries
    async function loadFeedback() {
      const res = await api('/api/feedback');
      if (!res.ok) { summary.textContent = 'Could not load feedback.'; return; }
      const { feedback, count, averageRating } = res.data;
      summary.textContent = count
        ? count + (count === 1 ? ' response' : ' responses') + (averageRating ? ' · average rating ' + averageRating + ' / 5' : '')
        : 'No feedback yet. Be the first.';
      list.innerHTML = feedback.map((f) =>
        '<li class="feedback-item"><p class="body-3">' + esc(f.message) + '</p>' +
        '<p class="caption-2 muted">' + esc(f.name) + (f.rating ? ' · ' + '★'.repeat(f.rating) : '') +
        ' · ' + new Date(f.createdAt).toLocaleDateString() + '</p></li>'
      ).join('');
    }

    // POST /api/feedback → save, then reload the list
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msgError.textContent = '';
      status.textContent = '';
      const message = form.elements.message.value.trim();
      if (message.length < 3) {
        msgError.textContent = 'Write at least a few words.';
        form.elements.message.focus();
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const res = await api('/api/feedback', { method: 'POST', body: { message, rating: form.elements.rating.value } });
      btn.disabled = false;
      if (!res.ok) {
        if (res.data.fields && res.data.fields.message) msgError.textContent = res.data.fields.message;
        status.textContent = res.data.error || 'Could not send. Try again.';
        return;
      }
      form.reset();
      status.textContent = 'Thanks! Your feedback was saved.';
      loadFeedback();
    });

    loadFeedback();
  }

  // ---------- Delete account (DELETE /api/me) ----------
  const del = document.querySelector('[data-delete-account]');
  if (del) {
    const err = document.querySelector('[data-delete-error]');
    del.addEventListener('click', async () => {
      if (!window.confirm('Delete your account, answers and room requests? This cannot be undone.')) return;
      del.disabled = true;
      const res = await api('/api/me', { method: 'DELETE' });
      if (!res.ok) {
        del.disabled = false;
        err.textContent = res.data.error || 'Could not delete your account. Try again.';
        return;
      }
      window.location.href = '/';
    });
  }
})();
