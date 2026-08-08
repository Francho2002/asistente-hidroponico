/** API pública local-first para componentes cliente. */
export { EYEBALLZ_TEMPLATE } from "./cultivo/eyeballz-template";
export { createCultivationFromTemplate, crearCultivoDesdePlantilla, crearId } from "./cultivo/instantiate";
export { loadCultivation, saveCultivation, deleteCultivation, upsertCultivation, emptyCultivationState } from "./cultivo/storage";
export { exportBackup, exportTemplate, importFile, validateBackup, validateTemplate } from "./cultivo/serialization";
export type * from "./cultivo/types";
