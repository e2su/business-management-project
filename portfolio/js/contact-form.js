/**
 * Contact form. There's no back-end, so a valid submission opens
 * the visitor's email app with the message pre-filled.
 */
window.App.contactForm = (() => {
  "use strict";
  const { $, $$ } = window.App;

  const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

  function isFieldValid(field) {
    const value = field.value.trim();
    if (!value) return false;
    return field.type !== "email" || EMAIL_PATTERN.test(value);
  }

  /** Marks invalid fields and returns true when every field is valid. */
  function validate(form) {
    let allValid = true;
    $$("input, textarea", form).forEach((field) => {
      const valid = isFieldValid(field);
      field.closest(".field").classList.toggle("invalid", !valid);
      if (!valid) allValid = false;
    });
    return allValid;
  }

  function buildMailtoLink(toAddress, subjectTemplate, { name, email, message }) {
    const subject = subjectTemplate.replace("{name}", name);
    const body = `${message}\n\n— ${name} (${email})`;
    return `mailto:${toAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function init({ email: toAddress, t }) {
    const form = $("#contact-form");
    if (!toAddress) return; // no email configured yet: the form stays hidden
    form.hidden = false;
    const status = $("#form-status");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate(form)) {
        status.textContent = t("form.invalid");
        return;
      }
      const data = Object.fromEntries(new FormData(form));
      window.location.href = buildMailtoLink(toAddress, t("form.subject"), data);
      status.textContent = t("form.opening");
      form.reset();
    });
  }

  return { init };
})();
