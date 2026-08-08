/** Maneja un único diálogo accesible: cerrar nunca valida ni guarda. */
export function createModal(dialog, form, onSubmit) {
  const close = () => {
    if (dialog.open) dialog.close();
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(new FormData(form));
  });
  dialog.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.type = "button";
    button.addEventListener("click", close);
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  return { close };
}
