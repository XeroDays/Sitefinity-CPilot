(function () {
  "use strict";

  // ── Container ─────────────────────────────────────────────────────────────
  var _container = null;

  function getContainer() {
    if (!_container) {
      _container = document.createElement("div");
      _container.id = "toast-container";
      _container.setAttribute("aria-live", "assertive");
      _container.setAttribute("aria-atomic", "false");
      document.body.appendChild(_container);
    }
    return _container;
  }

  // ── Show ──────────────────────────────────────────────────────────────────
  /**
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} [type='info']
   * @param {number} [duration=3500]
   */
  function show(message, type, duration) {
    type = type || "info";
    duration = duration == null ? 3500 : duration;

    var container = getContainer();
    var toast = document.createElement("div");
    toast.className = "toast toast--" + type;

    var icon = "";
    if (type === "success") icon = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>';
    else if (type === "error") icon = '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>';
    else if (type === "warning") icon = '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>';
    else icon = '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>';

    toast.innerHTML =
      '<span class="toast__icon">' + icon + "</span>" +
      '<span class="toast__message"></span>' +
      '<button type="button" class="toast__close" aria-label="Dismiss"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>';

    toast.querySelector(".toast__message").textContent = message;

    var closeBtn = toast.querySelector(".toast__close");
    closeBtn.addEventListener("click", function () {
      dismiss(toast);
    });

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(function () {
      toast.classList.add("toast--visible");
    });

    if (duration > 0) {
      setTimeout(function () {
        dismiss(toast);
      }, duration);
    }

    return toast;
  }

  function dismiss(toast) {
    toast.classList.remove("toast--visible");
    toast.classList.add("toast--hiding");
    setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.cpilotToast = {
    show: show,
    success: function (msg, dur) { return show(msg, "success", dur); },
    error: function (msg, dur) { return show(msg, "error", dur == null ? 6000 : dur); },
    info: function (msg, dur) { return show(msg, "info", dur); },
    warning: function (msg, dur) { return show(msg, "warning", dur); },
  };
})();
