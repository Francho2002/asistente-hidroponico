export function buildAiTemplatePrompt(template) {
  const reference = JSON.stringify(template, null, 2);
  return `Necesito crear una plantilla importable para la aplicación "Raíz — Asistente hidropónico local-first".

Voy a pegar debajo la descripción real de mi instalación, cultivo, equipamiento, nutrientes, instrumentos y preferencias. Convertí esa descripción en UNA plantilla JSON UTF-8 válida para la aplicación.

Reglas obligatorias:
1. Devolvé exclusivamente el JSON final: sin Markdown, sin comentarios, sin texto antes o después.
2. Conservá exactamente los campos estructurales requeridos por el ejemplo de referencia: "formato": "asistente-cultivo", "version": 1 y "tipo": "plantilla".
3. No inventes datos no confirmados. Cuando falte un valor, elegí una configuración conservadora, dejá listas o notas vacías cuando el esquema lo permita y no afirmes que existe un sensor, automatización o insumo que no se mencionó.
4. Modelá el equipamiento real de forma configurable: número y volumen de DWC, plantas, nutrientes, instrumentos, sensores y reglas. No copies el caso Eyeballz si mi descripción dice otra cosa.
5. Creá un plan de semanas coherente con las etapas y la receta confirmadas. Las celdas sin aplicación deben permanecer vacías; no inventes dosis.
6. Las fuentes de variables deben distinguir manual, automática y no disponible. Una integración SonoffLAN debe describirse como Home Assistant + SonoffLAN, nunca como una llamada directa a un puerto del dispositivo.
7. El resultado debe pasar validación al importarlo desde Configuración > Importar JSON.

Mi descripción real (reemplazá este texto por la tuya):
[PEGAR AQUÍ INSTALACIÓN, CULTIVO, INSUMOS, SENSORES Y PREFERENCIAS]

Ejemplo estructural editable. Usalo solo como referencia de esquema; no copies sus valores si mi descripción es distinta:
${reference}`;
}

export async function copyTemplatePrompt(prompt, clipboard = navigator.clipboard) {
  if (clipboard?.writeText) {
    await clipboard.writeText(prompt);
    return true;
  }
  const area = document.createElement("textarea");
  area.value = prompt;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("No se pudo copiar el prompt.");
  return true;
}
