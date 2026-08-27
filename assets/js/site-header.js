(function () {
  "use strict";

  document.querySelectorAll("[data-locale-select]").forEach(function (select) {
    select.addEventListener("change", function () {
      var target = select.value;
      if (target) window.location.assign(target);
    });
  });
})();
