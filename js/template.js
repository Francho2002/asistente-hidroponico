/** Carga la plantilla demostrativa desde una ruta estática, sin bundler. */
export async function loadEyeballzTemplate() {
  const response = await fetch("examples/eyeballz-4-dwc.example.json");
  if (!response.ok) throw new Error("No se pudo cargar la plantilla Eyeballz.");
  return response.json();
}

/**
 * Variant generated from the canonical 4-DWC reference so its 0–14 recipe can
 * never drift. It is downloaded/imported as an ordinary standalone JSON file.
 */
export function createEyeballz1DwcTemplate(referenceTemplate) {
  const template = structuredClone(referenceTemplate);
  const configuration = template.configuracion;
  template.id = "eyeballz-1-dwc-independiente";
  template.nombre = "Eyeballz — 1 DWC independiente";
  template.descripcion =
    "Plantilla editable para una semilla en lana de roca y un DWC independiente de 16 L de trabajo.";
  configuration.nombre = template.nombre;
  configuration.dwcs = [
    {
      id: "dwc-1",
      nombre: "DWC 1",
      capacidadNominalLitros: 20,
      volumenTrabajoLitros: 16,
    },
  ];
  configuration.plantas = [
    {
      id: "planta-a",
      nombre: "Planta A",
      variedad: "Eyeballz",
      banco: "Ripper Seeds",
      estado: "semilla_en_lana_de_roca",
    },
  ];
  configuration.asignacionesIniciales = [
    { plantaId: "planta-a", dwcId: "dwc-1" },
  ];
  configuration.inventario = configuration.inventario.map((item) => {
    if (["lana-roca", "maceta-rejilla", "piedra-difusora", "ventosa"].includes(item.id))
      return { ...item, cantidad: 1 };
    if (item.id === "microtubo") return { ...item, cantidad: 1 };
    return item;
  });
  return template;
}

export async function loadEyeballz1DwcTemplate() {
  return createEyeballz1DwcTemplate(await loadEyeballzTemplate());
}
export function validateTemplate(file) {
  if (!file || file.formato !== "asistente-cultivo" || file.version !== 1)
    throw new Error("Formato o versión de archivo no reconocidos.");
  if (!["plantilla", "copia-seguridad", "sincronizacion"].includes(file.tipo))
    throw new Error(
      "El archivo debe ser una plantilla o una copia de seguridad.",
    );
  if (file.tipo === "plantilla") {
    const c = file.configuracion;
    if (
      !c ||
      !Array.isArray(c.dwcs) ||
      !Array.isArray(c.plantas) ||
      !c.plan ||
      !Array.isArray(c.plan.semanas) ||
      !c.estadoInicial ||
      !Array.isArray(c.asignacionesIniciales)
    )
      throw new Error(
        "La plantilla no incluye la configuración mínima del cultivo.",
      );
  }
  if (file.tipo === "copia-seguridad") {
    const c = file.cultivo;
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id ||
      typeof c.nombre !== "string" ||
      !Array.isArray(c.dwcs) ||
      !Array.isArray(c.plantas) ||
      !Array.isArray(c.eventos) ||
      !Array.isArray(c.tareas) ||
      !Array.isArray(c.asignaciones) ||
      !Array.isArray(c.inventario) ||
      !c.plan ||
      !Array.isArray(c.plan.semanas) ||
      !c.estado ||
      typeof c.estado.semanaActiva !== "number"
    )
      throw new Error(
        "La copia de seguridad está incompleta o no tiene una estructura de cultivo válida.",
      );
    if (
      c.dwcs.some((d) => !d || typeof d.id !== "string") ||
      c.plantas.some((p) => !p || typeof p.id !== "string") ||
      c.plan.semanas.some((w) => !w || typeof w.semana !== "number")
    )
      throw new Error(
        "La copia de seguridad contiene identificadores o plan semanales inválidos.",
      );
  }
  if (file.tipo === "sincronizacion") {
    const c = file.cultivo;
    if (!c || typeof file.cultivoUid !== "string" || c.id !== file.cultivoUid)
      throw new Error("La copia de sincronización no tiene una identidad de cultivo válida.");
    validateTemplate({
      formato: file.formato,
      version: file.version,
      tipo: "copia-seguridad",
      cultivo: c,
    });
  }
  return file;
}
