var CustardFun = (function () {
  'use strict';

  function init() {
    // Fun page is primarily static HTML -- no dynamic rendering needed.
    // Quiz cards link to quiz.html?mode=X, link-out cards go to group/forecast-map.
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init: init };
})();
