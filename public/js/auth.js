/* Client-side auth helpers: form UX, disabled states, basic validation */
(function () {
  function disableDuring(el, fn) {
    if (!el) return fn();
    el.disabled = true;
    try {
      return fn();
    } finally {
      el.disabled = false;
    }
  }

  function wireLogin() {
    const form = document.getElementById("login-form");
    if (!form) return;
    const submit = document.getElementById("login-submit");
    const toggle = document.getElementById("toggle-password");
    const pwd = document.getElementById("password");

    if (toggle && pwd) {
      toggle.addEventListener("click", () => {
        pwd.type = pwd.type === "password" ? "text" : "password";
        toggle.textContent = pwd.type === "password" ? "👁️" : "🙈";
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      disableDuring(submit, () => form.submit());
    });
  }

  function wireRegister() {
    const form = document.getElementById("register-form");
    if (!form) return;
    const submit = document.getElementById("register-submit");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      disableDuring(submit, () => form.submit());
    });
  }

  window.addEventListener("load", () => {
    wireLogin();
    wireRegister();
  });
})();
