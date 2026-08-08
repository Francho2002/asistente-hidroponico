export function downloadJson(name, payload) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([payload], { type: "application/json" }),
  );
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

export async function importCultivationFile(file, api) {
  if (!file) return false;
  const parsed = api.validateTemplate(JSON.parse(await file.text()));
  const cultivation =
    parsed.tipo === "plantilla"
      ? api.createCultivation(parsed)
      : api.normalizeCultivation(parsed.cultivo);
  await api.store.add(cultivation);
  return parsed.tipo;
}
