var CustardUpdates = (function () {
  'use strict';

  var _storeSlug = null;
  var _storeName = null;

  function init() {
    // Read store from planner-shared.js
    if (typeof CustardPlanner !== 'undefined' && CustardPlanner.getPrimaryStoreSlug) {
      _storeSlug = CustardPlanner.getPrimaryStoreSlug();
    }
    if (_storeSlug) {
      _storeName = _storeSlug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    setupCalendarSection();
    setupAlertForm();
    setupStoreDisplay();
  }

  function setupStoreDisplay() {
    // Show auto-filled store name in calendar and alerts sections
    var storeDisplayEls = document.querySelectorAll('.store-auto-fill');
    for (var i = 0; i < storeDisplayEls.length; i++) {
      storeDisplayEls[i].textContent = _storeName || 'your store';
    }
    // Set hidden slug input
    var slugInput = document.getElementById('alert-store-slug');
    if (slugInput && _storeSlug) slugInput.value = _storeSlug;
  }

  function setupCalendarSection() {
    var calBtn = document.getElementById('cal-subscribe-btn');
    if (!calBtn || !_storeSlug) return;
    var workerBase = (typeof WORKER_BASE !== 'undefined') ? WORKER_BASE : 'https://custard.chriskaschner.com';
    calBtn.href = workerBase + '/api/v1/stores/' + _storeSlug + '/calendar.ics';
    calBtn.target = '_blank';
  }

  function setupAlertForm() {
    var form = document.getElementById('alert-form');
    if (!form) return;

    // Chip toggle behavior
    var chips = form.querySelectorAll('.alert-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', function () {
        this.classList.toggle('selected');
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitAlertForm(form);
    });
  }

  function submitAlertForm(form) {
    var email = form.querySelector('input[type="email"]').value;
    var slug = _storeSlug;
    var selectedChips = form.querySelectorAll('.alert-chip.selected');
    var favorites = [];
    for (var i = 0; i < selectedChips.length; i++) {
      favorites.push(selectedChips[i].textContent.trim());
    }

    var statusEl = document.getElementById('alert-status');
    var workerBase = (typeof WORKER_BASE !== 'undefined') ? WORKER_BASE : 'https://custard.chriskaschner.com';

    fetch(workerBase + '/api/v1/alerts/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        slug: slug,
        favorites: favorites,
        frequency: 'daily'
      })
    }).then(function (resp) {
      if (resp.ok) {
        if (statusEl) statusEl.textContent = 'You are signed up! Check your email to confirm.';
        if (statusEl) statusEl.style.color = '#2e7d32';
      } else {
        return resp.json().then(function (data) {
          if (statusEl) statusEl.textContent = data.error || 'Something went wrong. Try again.';
          if (statusEl) statusEl.style.color = '#c62828';
        });
      }
    }).catch(function () {
      if (statusEl) statusEl.textContent = 'Network error. Check your connection and try again.';
      if (statusEl) statusEl.style.color = '#c62828';
    });
  }

  // Listen for store changes from SharedNav
  document.addEventListener('sharednav:storechange', function () {
    if (typeof CustardPlanner !== 'undefined' && CustardPlanner.getPrimaryStoreSlug) {
      _storeSlug = CustardPlanner.getPrimaryStoreSlug();
      _storeName = _storeSlug ? _storeSlug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : null;
    }
    setupStoreDisplay();
    setupCalendarSection();
  });

  document.addEventListener('DOMContentLoaded', init);

  return { init: init };
})();
