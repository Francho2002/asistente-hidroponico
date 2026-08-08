/** Carga la plantilla demostrativa desde una ruta estática, sin bundler. */
export async function loadEyeballzTemplate() {
  const response = await fetch("examples/eyeballz-4-dwc.example.json");
  if (!response.ok) throw new Error("No se pudo cargar la plantilla Eyeballz.");
  return response.json();
}
export function validateTemplate(file) {
  if (!file || file.formato !== "asistente-cultivo" || file.version !== 1)
    throw new Error("Formato o versión de archivo no reconocidos.");
  if (!["plantilla", "copia-seguridad"].includes(file.tipo))
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
  return file;
}
