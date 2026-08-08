import {
  applyMergePlan,
  buildSyncFile,
  createMergePlan,
  validateSyncFile,
} from "../core/sync.js";
import { downloadJson } from "./import-export.js";

const label = (value) => String(value || "").replace(/[_-]/g, " ");

export function createSyncFeatures(api) {
  let pending = null;
  const chooseFile = () => new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
  const exportForOther = () => {
    const cultivation = api.cultivation();
    if (!cultivation) return;
    const file = buildSyncFile(cultivation, api.now());
    downloadJson(
      `${cultivation.variedad.toLowerCase().replace(/\s+/g, "-")}-sincronizacion.json`,
      JSON.stringify(file, null, 2),
    );
    api.showToast("Copia de sincronización descargada. Llevála al otro dispositivo.");
  };
  const previewMarkup = (plan) => {
    const s = plan.summary;
    const summary = `<div class="sync-summary"><span><b>${s.added}</b> agregados</span><span><b>${s.updated}</b> actualizados</span><span><b>${s.conserved}</b> conservados</span><span><b>${s.conflicts}</b> conflictos</span></div>`;
    const conflicts = plan.conflicts.length
      ? `<h3>Decisiones necesarias</h3><p class="muted">Elegí qué versión conservar en cada cambio simultáneo. La app nunca pisa esos cambios por su cuenta.</p>${plan.conflicts.map((conflict, index) => `<fieldset class="sync-conflict"><legend>${api.escape(conflict.label)}</legend><label><input type="radio" required name="sync-choice-${index}" value="local"> Este dispositivo</label><label><input type="radio" name="sync-choice-${index}" value="imported"> Archivo importado</label></fieldset>`).join("")}`
      : '<p class="muted">No hay conflictos. Podés aplicar esta unión segura.</p>';
    return `<p>Revisá el resultado antes de aplicarlo. Los registros ausentes nunca se borran.</p>${summary}${conflicts}<p class="modal-note">Después de aplicar, exportá esta versión y fusionála de vuelta en el otro dispositivo.</p>`;
  };
  async function openMerge() {
    const file = await chooseFile();
    if (!file) return;
    try {
      const parsed = validateSyncFile(JSON.parse(await file.text()));
      const cultivation = api.cultivation();
      if (parsed.cultivoUid !== cultivation.id)
        throw new Error("Esta copia pertenece a otro cultivo. Importala como cultivo inicial; no se puede fusionar por nombre.");
      pending = createMergePlan(cultivation, parsed.cultivo);
      api.setModalAction("sync-apply");
      api.openModal("Previsualizar sincronización", previewMarkup(pending), {
        submitLabel: pending.conflicts.length ? "Resolver y aplicar" : "Aplicar fusión",
      });
    } catch (error) {
      api.showToast(error.message || "No se pudo abrir la copia de sincronización.");
    }
  }
  async function apply(data) {
    if (!pending) return api.showToast("No hay una sincronización pendiente.");
    try {
      const choices = Object.fromEntries(
        pending.conflicts.map((conflict, index) => [
          conflict.key,
          String(data.get(`sync-choice-${index}`) || ""),
        ]),
      );
      const merged = applyMergePlan(pending, choices);
      merged.actualizadoEn = api.now();
      await api.store.applySync(merged);
      pending = null;
      api.closeModal();
      api.render();
      api.showToast("Sincronización aplicada. Exportá el resultado para devolverlo al otro dispositivo.");
    } catch (error) {
      api.showToast(error.message || "Revisá las decisiones de la sincronización.");
    }
  }
  async function undo() {
    if (!(await api.store.undoSync()))
      return api.showToast("No hay una sincronización que se pueda deshacer; puede haber cambios posteriores.");
    api.render();
    api.showToast("Se deshizo la última sincronización local.");
  }
  return { exportForOther, openMerge, apply, undo, canUndo: () => api.store.canUndoSync() };
}
