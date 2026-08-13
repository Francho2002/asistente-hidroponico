import { predefinedTemplates } from "../template.js";

/**
 * Selector reutilizable para bienvenida y configuración. Sus acciones son
 * botones normales: cerrar el diálogo nunca dispara validación ni creación.
 */
export function renderPredefinedTemplateSelector(escape) {
  const cards = predefinedTemplates
    .map(
      (template) =>
        `<article class="template-card"><p class="eyebrow">Plantilla editable</p><h3>${escape(template.title)}</h3><p>${escape(template.description)}</p><ul class="template-facts">${template.facts.map((fact) => `<li>${escape(fact)}</li>`).join("")}</ul><div class="actions template-card-actions"><button type="button" class="primary" data-predefined-create="${escape(template.key)}">Crear cultivo</button><button type="button" class="secondary" data-predefined-download="${escape(template.key)}">Descargar JSON</button></div></article>`,
    )
    .join("");
  return `<p id="predefined-template-description" class="modal-note">Elegí un punto de partida. Cada una se crea como un cultivo local y queda completamente editable.</p><div class="template-grid" aria-describedby="predefined-template-description">${cards}</div>`;
}
