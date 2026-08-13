/** Carga plantillas estáticas sin bundler, desde el mismo origen de la app. */
async function loadTemplate(path, name) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo cargar la plantilla ${name}.`);
  return response.json();
}

export async function loadEyeballzTemplate() {
  return loadTemplate("examples/eyeballz-4-dwc.example.json", "Eyeballz");
}

export async function loadEyeballzCakeCrasherTemplate() {
  return loadTemplate(
    "examples/eyeballz-cake-crasher-4-dwc.example.json",
    "Eyeballz + Cake Crasher",
  );
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

export const predefinedTemplates = Object.freeze([
  {
    key: "eyeballz-4-dwc",
    title: "Eyeballz — 4 DWC independientes",
    description: "Cuatro plantas Eyeballz, una por DWC de 16 L de trabajo.",
    facts: ["4 DWC · 16 L c/u", "4 × Eyeballz · Ripper Seeds"],
    fileName: "eyeballz-4-dwc.example.json",
  },
  {
    key: "eyeballz-1-dwc",
    title: "Eyeballz — 1 DWC independiente",
    description: "Una planta Eyeballz y un DWC de 16 L de trabajo.",
    facts: ["1 DWC · 16 L", "1 × Eyeballz · Ripper Seeds"],
    fileName: "eyeballz-1-dwc.example.json",
  },
  {
    key: "eyeballz-cake-crasher-4-dwc",
    title: "Eyeballz + Cake Crasher — 4 DWC independientes",
    description:
      "Una Eyeballz y tres Cake Crasher; la receta compartida queda ajustable por DWC.",
    facts: [
      "4 DWC · 16 L c/u",
      "1 × Eyeballz · Ripper Seeds",
      "3 × Cake Crasher · Shuga Seeds",
    ],
    fileName: "eyeballz-cake-crasher-4-dwc.example.json",
  },
]);

export async function loadPredefinedTemplate(key) {
  if (key === "eyeballz-4-dwc") return loadEyeballzTemplate();
  if (key === "eyeballz-1-dwc") return loadEyeballz1DwcTemplate();
  if (key === "eyeballz-cake-crasher-4-dwc")
    return loadEyeballzCakeCrasherTemplate();
  throw new Error("La plantilla predefinida no existe.");
}

export function predefinedTemplateFileName(key) {
  const template = predefinedTemplates.find((item) => item.key === key);
  if (!template) throw new Error("La plantilla predefinida no existe.");
  return template.fileName;
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
