export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );

export const formatDate = (iso) =>
  iso
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso))
    : "Sin registro";

export const card = (title, content, classes = "") =>
  `<article class="card ${classes}"><h2>${title}</h2>${content}</article>`;
