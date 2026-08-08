"use client";

import {
  ArrowRight,
  Bell,
  Check,
  Download,
  FileJson,
  Leaf,
  LockKeyhole,
  Sprout,
  Upload,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HydroDashboard } from "./components/HydroDashboard";
import { Modal } from "./components/Modal";
import {
  EYEBALLZ_TEMPLATE,
  createCultivationFromTemplate,
  crearId,
  deleteCultivation,
  emptyCultivationState,
  exportBackup,
  exportTemplate,
  importFile,
  loadCultivation,
  saveCultivation,
} from "@/lib";
import type {
  Alerta,
  Cultivo,
  EstadoAplicacion,
  Evento,
  EventoCambioSolucion,
  EventoLecturaAmbiental,
  EventoMedicionSolucion,
  EventoObservacion,
  EventoReposicionAgua,
  FechaISO,
  ItemInventario,
  Tarea,
} from "@/lib/cultivo/types";

type ActionKind = "agua" | "solucion" | "observacion" | "nutrientes";
type ConfigurationPanel = "sistema" | "sonoff" | "alertas" | "inventario";

interface ImportedAmbientReading {
  fecha: FechaISO;
  temperatura: number;
  humedad: number;
  humidificadorEncendido?: boolean;
}

function parseAmbientReadings(text: string): ImportedAmbientReading[] {
  const parsed: unknown = JSON.parse(text);
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed) && "readings" in parsed
    ? (parsed as { readings: unknown }).readings
    : parsed;
  const entries = Array.isArray(root) ? root : [root];
  return entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Lectura ${index + 1} inválida.`);
    const row = entry as Record<string, unknown>;
    const temperatura = Number(row.temperatura ?? row.temperature ?? row.currentTemperature);
    const humedad = Number(row.humedad ?? row.humidity ?? row.currentHumidity);
    if (!Number.isFinite(temperatura) || !Number.isFinite(humedad)) throw new Error(`Lectura ${index + 1}: faltan temperatura o humedad.`);
    const rawRelay = row.humidificadorEncendido ?? row.humidifier ?? row.switch;
    const humidificadorEncendido = rawRelay === undefined ? undefined : rawRelay === true || rawRelay === 1 || String(rawRelay).toLowerCase() === "on";
    const rawDate = String(row.fecha ?? row.timestamp ?? row.time ?? new Date().toISOString());
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) throw new Error(`Lectura ${index + 1}: fecha inválida.`);
    return { fecha: date.toISOString(), temperatura, humedad, humidificadorEncendido };
  });
}

function addHours(iso: FechaISO, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function currentPlan(cultivo: Cultivo) {
  return cultivo.plan.semanas.find((week) => week.semana === cultivo.estado.semanaActiva) ?? cultivo.plan.semanas[0];
}

function Welcome({ onStart, onImport, onDownload }: { onStart: () => void; onImport: () => void; onDownload: () => void }) {
  return (
    <div className="welcome-page">
      <header className="welcome-nav">
        <div className="brand">
          <span className="brand-mark"><Sprout size={23} /></span>
          <span><strong>Raíz</strong><small>Asistente hidropónico</small></span>
        </div>
        <div className="welcome-actions">
          <button className="button button-secondary" type="button" onClick={onImport}><Upload size={17} /> Importar archivo</button>
          <button className="button button-primary" type="button" onClick={onStart}>Abrir ejemplo</button>
        </div>
      </header>

      <main className="welcome-main">
        <section className="welcome-hero">
          <div className="welcome-copy">
            <p className="eyebrow">Cultivo local-first, de verdad</p>
            <h1>Tu cultivo, <span>con contexto.</span></h1>
            <p>Configurá lo que realmente tenés, seguí cada DWC por separado y recibí avisos claros durante todo el ciclo. Los datos permanecen en tu navegador.</p>
            <div className="welcome-cta">
              <button className="button button-primary" type="button" onClick={onStart}>Iniciar ejemplo Eyeballz <ArrowRight size={18} /></button>
              <button className="button button-secondary" type="button" onClick={onDownload}><Download size={17} /> Descargar plantilla</button>
            </div>
            <div className="welcome-points">
              <span><Check size={15} /> Sin cuenta</span>
              <span><LockKeyhole size={15} /> Datos en tu dispositivo</span>
              <span><FileJson size={15} /> Importable y exportable</span>
            </div>
          </div>

          <div className="preview-card" aria-label="Vista previa del panel">
            <div className="preview-window">
              <div className="preview-top"><i /><i /><i /></div>
              <div className="preview-body">
                <div className="preview-banner"><small>Semana 0 · Cultivo en curso</small><h3>Enraizado</h3><p>Eyeballz · 4 DWC independientes</p></div>
                <div className="preview-metrics"><div><span>Temperatura</span><strong>24°</strong></div><div><span>Humedad</span><strong>72%</strong></div><div><span>Fotoperiodo</span><strong>18/6</strong></div></div>
                <div className="preview-buckets">{[1, 2, 3, 4].map((number) => <div className="preview-bucket" key={number}><span>DWC {number}</span><strong>Planta {String.fromCharCode(64 + number)}</strong><em /></div>)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="welcome-features">
          <article className="welcome-feature"><span><Sprout size={20} /></span><h3>Cuatro historias independientes</h3><p>Cada DWC conserva sus mediciones, acciones y asignaciones de planta.</p></article>
          <article className="welcome-feature"><span><Leaf size={20} /></span><h3>Una guía, no una planilla</h3><p>La receta, las tareas y los avisos cambian junto con la etapa activa.</p></article>
          <article className="welcome-feature"><span><WifiOff size={20} /></span><h3>Funciona sin backend</h3><p>IndexedDB conserva el cultivo localmente y las copias JSON te pertenecen.</p></article>
        </section>
      </main>
    </div>
  );
}

export default function HydroApp() {
  const [state, setState] = useState<EstadoAplicacion>(() => emptyCultivationState());
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [configurationOpen, setConfigurationOpen] = useState<ConfigurationPanel | null>(null);
  const [selectedDwc, setSelectedDwc] = useState("dwc-1");
  const [actionKind, setActionKind] = useState<ActionKind>("agua");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const cultivation = useMemo(() => {
    return state.cultivos.find((item) => item.id === state.cultivoSeleccionadoId) ?? state.cultivos[0];
  }, [state]);

  useEffect(() => {
    loadCultivation().then(setState).catch(() => setState(emptyCultivationState()));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((text: string, error = false) => setToast({ text, error }), []);

  const persistCultivation = useCallback(async (updated: Cultivo) => {
    const current = state;
    const exists = current.cultivos.some((item) => item.id === updated.id);
    const next: EstadoAplicacion = {
      ...current,
      cultivoSeleccionadoId: updated.id,
      cultivos: exists ? current.cultivos.map((item) => item.id === updated.id ? updated : item) : [...current.cultivos, updated],
      actualizadoEn: new Date().toISOString(),
    };
    setState(next);
    const saved = await saveCultivation(next);
    setState(saved);
  }, [state]);

  const startExample = useCallback(async () => {
    const newCultivation = createCultivationFromTemplate(EYEBALLZ_TEMPLATE);
    await persistCultivation(newCultivation);
    showToast("Ejemplo Eyeballz creado. El ciclo comienza hoy.");
  }, [persistCultivation, showToast]);

  const openMeasurement = useCallback((dwcId?: string) => {
    if (dwcId) setSelectedDwc(dwcId);
    else if (cultivation?.dwcs[0]) setSelectedDwc(cultivation.dwcs[0].id);
    setMeasurementOpen(true);
  }, [cultivation]);

  const openAction = useCallback((kind?: string, dwcId?: string) => {
    if (kind === "solucion" || kind === "observacion" || kind === "nutrientes" || kind === "agua") setActionKind(kind);
    else setActionKind("agua");
    if (dwcId) setSelectedDwc(dwcId);
    else if (cultivation?.dwcs[0]) setSelectedDwc(cultivation.dwcs[0].id);
    setActionOpen(true);
  }, [cultivation]);

  const submitMeasurement = useCallback(async (form: FormData) => {
    if (!cultivation) return;
    const dwcId = String(form.get("dwcId") || selectedDwc);
    const ph = Number(form.get("ph"));
    const ec = Number(form.get("ec"));
    const temperature = Number(form.get("temperature"));
    if (![ph, ec, temperature].every(Number.isFinite)) {
      showToast("Completá pH, EC y temperatura.", true);
      return;
    }
    const now = new Date().toISOString();
    const plan = currentPlan(cultivation);
    const event: EventoMedicionSolucion = {
      id: crearId("evento"),
      tipo: "medicion_solucion",
      fecha: now,
      alcance: { tipo: "dwc", id: dwcId },
      etapaActiva: cultivation.estado.etapaActiva,
      fuente: { modo: "manual", equipoId: "labymos-ez9902", etiqueta: "Labymos EZ9902" },
      valores: {
        ph: { variable: "ph", valor: ph, unidad: "pH" },
        ec: { variable: "ec", valor: ec, unidad: "mS/cm" },
        temperaturaSolucion: { variable: "temperatura_solucion", valor: temperature, unidad: "°C" },
      },
    };
    const tasks = cultivation.tareas.map((task) => task.estado === "pendiente" && task.alcance.id === dwcId && task.reglaId === "medir-solucion" ? { ...task, estado: "completada" as const, completadaEn: now, eventoId: event.id } : task);
    tasks.push({
      id: crearId("tarea"),
      reglaId: "medir-solucion",
      titulo: "Medir solución",
      descripcion: "Registrar pH, EC y temperatura con el Labymos.",
      alcance: { tipo: "dwc", id: dwcId },
      venceEn: addHours(now, 48),
      estado: "pendiente",
    });
    const alerts: Alerta[] = [...cultivation.alertas];
    if (ph < 5.5 || ph > 6.5) alerts.push({ id: crearId("alerta"), reglaId: "ph-general", severidad: "alerta", titulo: "pH fuera del rango general", detalle: `Se registró pH ${ph}; el rango general del ejemplo es 5,5–6,5.`, alcance: { tipo: "dwc", id: dwcId }, creadaEn: now, estado: "activa" });
    if (plan.ecObjetivo !== undefined && Math.abs(ec - plan.ecObjetivo) >= 0.2) alerts.push({ id: crearId("alerta"), reglaId: "ec-objetivo", severidad: "aviso", titulo: "EC alejada del objetivo", detalle: `Se registró EC ${ec}; el objetivo de la semana es ${plan.ecObjetivo}.`, alcance: { tipo: "dwc", id: dwcId }, creadaEn: now, estado: "activa" });
    await persistCultivation({ ...cultivation, actualizadoEn: now, eventos: [...cultivation.eventos, event], tareas: tasks, alertas: alerts });
    setMeasurementOpen(false);
    showToast("Medición guardada y evaluada.");
  }, [cultivation, persistCultivation, selectedDwc, showToast]);

  const submitAction = useCallback(async (form: FormData) => {
    if (!cultivation) return;
    const now = new Date().toISOString();
    const dwcId = String(form.get("dwcId") || selectedDwc);
    let event: Evento;
    let tasks = [...cultivation.tareas];

    if (actionKind === "agua") {
      const liters = Number(form.get("liters"));
      if (!Number.isFinite(liters) || liters <= 0) return showToast("Indicá cuántos litros añadiste.", true);
      event = { id: crearId("evento"), tipo: "reposicion_agua", fecha: now, alcance: { tipo: "dwc", id: dwcId }, etapaActiva: cultivation.estado.etapaActiva, fuente: { modo: "manual", etiqueta: "Registro manual" }, litros: liters } satisfies EventoReposicionAgua;
      tasks = tasks.map((task) => task.estado === "pendiente" && task.alcance.id === dwcId && task.reglaId === "revisar-agua" ? { ...task, estado: "completada" as const, completadaEn: now, eventoId: event.id } : task);
    } else if (actionKind === "solucion") {
      const target = String(form.get("target") || dwcId);
      const ids = target === "todos" ? cultivation.dwcs.map((dwc) => dwc.id) : [target];
      const events: EventoCambioSolucion[] = ids.map((id) => ({ id: crearId("evento"), tipo: "cambio_solucion", fecha: now, alcance: { tipo: "dwc", id }, etapaActiva: cultivation.estado.etapaActiva, fuente: { modo: "manual", etiqueta: "Registro manual" }, volumenLitros: cultivation.dwcs.find((dwc) => dwc.id === id)?.volumenTrabajoLitros ?? 16, tipoCambio: cultivation.eventos.some((item) => item.tipo === "cambio_solucion") ? "renovacion" : "preparacion_inicial" }));
      const eventIds = new Set(events.map((item) => item.alcance.id));
      tasks = tasks.map((task) => task.estado === "pendiente" && task.reglaId === "renovar-solucion" && eventIds.has(task.alcance.id) ? { ...task, estado: "completada" as const, completadaEn: now } : task);
      ids.forEach((id) => tasks.push({ id: crearId("tarea"), reglaId: "renovar-solucion", titulo: "Renovar solución", descripcion: "Renovación semanal de la solución.", alcance: { tipo: "dwc", id }, venceEn: addHours(now, 168), estado: "pendiente" }));
      await persistCultivation({ ...cultivation, actualizadoEn: now, eventos: [...cultivation.eventos, ...events], tareas: tasks });
      setActionOpen(false);
      showToast(target === "todos" ? "Renovación registrada para los cuatro DWC." : "Renovación registrada.");
      return;
    } else if (actionKind === "observacion") {
      const plantId = String(form.get("plantId") || cultivation.plantas[0]?.id);
      const observation = String(form.get("observation") || "").trim();
      if (!observation) return showToast("Escribí una observación.", true);
      event = { id: crearId("evento"), tipo: "observacion", fecha: now, alcance: { tipo: "planta", id: plantId }, etapaActiva: cultivation.estado.etapaActiva, fuente: { modo: "manual", etiqueta: "Registro manual" }, observacion: observation } satisfies EventoObservacion;
    } else {
      const productId = String(form.get("productId") || "nutriente-micro");
      const amount = Number(form.get("amount"));
      const item = cultivation.inventario.find((inventory) => inventory.id === productId);
      if (!item || !Number.isFinite(amount) || amount <= 0) return showToast("Indicá el producto y la cantidad.", true);
      event = { id: crearId("evento"), tipo: "nutricion", fecha: now, alcance: { tipo: "dwc", id: dwcId }, etapaActiva: cultivation.estado.etapaActiva, fuente: { modo: "manual", etiqueta: "Registro manual" }, productos: [{ inventarioId: item.id, nombre: item.nombre, cantidad: amount, unidad: "mL" }] };
      const inventory = cultivation.inventario.map((inventoryItem) => inventoryItem.id === productId ? { ...inventoryItem, cantidad: inventoryItem.unidad === "L" ? Math.max(0, inventoryItem.cantidad - amount / 1000) : Math.max(0, inventoryItem.cantidad - amount) } : inventoryItem);
      await persistCultivation({ ...cultivation, actualizadoEn: now, eventos: [...cultivation.eventos, event], inventario: inventory });
      setActionOpen(false);
      showToast("Nutrición registrada e inventario actualizado.");
      return;
    }
    await persistCultivation({ ...cultivation, actualizadoEn: now, eventos: [...cultivation.eventos, event], tareas: tasks });
    setActionOpen(false);
    showToast("Acción guardada en el historial.");
  }, [actionKind, cultivation, persistCultivation, selectedDwc, showToast]);

  const toggleTask = useCallback(async (taskId: string) => {
    if (!cultivation) return;
    const now = new Date().toISOString();
    const tasks = cultivation.tareas.map((task) => task.id === taskId ? { ...task, estado: task.estado === "completada" ? "pendiente" as const : "completada" as const, completadaEn: task.estado === "completada" ? undefined : now } : task);
    await persistCultivation({ ...cultivation, actualizadoEn: now, tareas: tasks });
    showToast("Tarea actualizada.");
  }, [cultivation, persistCultivation, showToast]);

  const confirmAdvance = useCallback(async () => {
    if (!cultivation) return;
    const nextWeek = Math.min(14, cultivation.estado.semanaActiva + 1);
    if (nextWeek === cultivation.estado.semanaActiva) return;
    const nextPlan = cultivation.plan.semanas.find((week) => week.semana === nextWeek)!;
    const now = new Date().toISOString();
    const event: Evento = { id: crearId("evento"), tipo: "etapa", fecha: now, alcance: { tipo: "cultivo" }, etapaActiva: nextPlan.etapa, fuente: { modo: "manual", etiqueta: "Confirmado por el usuario" }, semana: nextWeek, etapaAnterior: cultivation.estado.etapaActiva, etapaNueva: nextPlan.etapa, confirmado: true };
    const changedPhotoperiod = currentPlan(cultivation).fotoperiodo !== nextPlan.fotoperiodo;
    const tasks: Tarea[] = changedPhotoperiod ? [...cultivation.tareas, { id: crearId("tarea"), titulo: `Configurar fotoperiodo ${nextPlan.fotoperiodo}`, descripcion: "Revisar el temporizador y los controles binarios del LED.", alcance: { tipo: "cultivo" }, venceEn: now, estado: "pendiente" }] : cultivation.tareas;
    await persistCultivation({ ...cultivation, actualizadoEn: now, estado: { ...cultivation.estado, semanaActiva: nextWeek, etapaActiva: nextPlan.etapa }, eventos: [...cultivation.eventos, event], tareas: tasks });
    setStageOpen(false);
    showToast(`Semana ${nextWeek} activada: ${nextPlan.etapa}.`);
  }, [cultivation, persistCultivation, showToast]);

  const importSelectedFile = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      const imported = importFile(await file.text());
      const importedCultivation = imported.tipo === "plantilla" ? createCultivationFromTemplate(imported.archivo) : imported.archivo.cultivo;
      await persistCultivation(importedCultivation);
      showToast(imported.tipo === "plantilla" ? "Plantilla importada como cultivo nuevo." : "Copia de seguridad restaurada.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo importar el archivo.", true);
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  }, [persistCultivation, showToast]);

  const exportCurrent = useCallback(() => {
    if (!cultivation) return;
    downloadText(`cultivo-${cultivation.variedad.toLowerCase()}-backup.json`, exportBackup(cultivation));
    showToast("Copia de seguridad descargada.");
  }, [cultivation, showToast]);

  const downloadTemplate = useCallback(() => {
    downloadText("eyeballz-4-dwc.example.json", exportTemplate(EYEBALLZ_TEMPLATE));
    showToast("Plantilla descargada.");
  }, [showToast]);

  const requestNotifications = useCallback(async () => {
    if (!("Notification" in window)) return showToast("Este navegador no ofrece notificaciones.", true);
    const permission = await Notification.requestPermission();
    showToast(permission === "granted" ? "Notificaciones activadas." : "Las notificaciones quedaron desactivadas.", permission !== "granted");
  }, [showToast]);

  const submitSystemConfiguration = useCallback(async (form: FormData) => {
    if (!cultivation) return;
    const number = (name: string, fallback: number) => {
      const value = Number(form.get(name));
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    const temperatureTarget = number("temperatureTarget", currentPlan(cultivation).temperaturaObjetivoC);
    const now = new Date().toISOString();
    const updated: Cultivo = {
      ...cultivation,
      nombre: String(form.get("name") || cultivation.nombre).trim(),
      variedad: String(form.get("variety") || cultivation.variedad).trim(),
      banco: String(form.get("bank") || cultivation.banco || "").trim() || undefined,
      espacio: {
        ...cultivation.espacio,
        largoM: number("length", cultivation.espacio.largoM),
        anchoM: number("width", cultivation.espacio.anchoM),
        altoM: number("height", cultivation.espacio.altoM),
      },
      dwcs: cultivation.dwcs.map((dwc) => ({
        ...dwc,
        nombre: String(form.get(`name-${dwc.id}`) || dwc.nombre).trim(),
        volumenTrabajoLitros: number(`volume-${dwc.id}`, dwc.volumenTrabajoLitros),
      })),
      plan: { ...cultivation.plan, semanas: cultivation.plan.semanas.map((week) => ({ ...week, temperaturaObjetivoC: temperatureTarget })) },
      actualizadoEn: now,
    };
    await persistCultivation(updated);
    setConfigurationOpen(null);
    showToast("Configuración del sistema actualizada.");
  }, [cultivation, persistCultivation, showToast]);

  const submitInventoryItem = useCallback(async (form: FormData) => {
    if (!cultivation) return;
    const quantity = Number(form.get("quantity"));
    const name = String(form.get("name") || "").trim();
    if (!name || !Number.isFinite(quantity) || quantity < 0) return showToast("Completá nombre y cantidad.", true);
    const item: ItemInventario = {
      id: crearId("insumo"),
      nombre: name,
      cantidad: quantity,
      unidad: String(form.get("unit") || "unidad") as ItemInventario["unidad"],
      umbralBajo: Number(form.get("lowStock")) || undefined,
      notas: String(form.get("notes") || "").trim() || undefined,
    };
    await persistCultivation({ ...cultivation, inventario: [...cultivation.inventario, item], actualizadoEn: new Date().toISOString() });
    setConfigurationOpen(null);
    showToast("Insumo agregado al inventario.");
  }, [cultivation, persistCultivation, showToast]);

  const toggleAlertRule = useCallback(async (ruleId: string) => {
    if (!cultivation) return;
    await persistCultivation({ ...cultivation, reglasAlertas: cultivation.reglasAlertas.map((rule) => rule.id === ruleId ? { ...rule, activa: !rule.activa } : rule), actualizadoEn: new Date().toISOString() });
  }, [cultivation, persistCultivation]);

  const submitSonoffReadings = useCallback(async (form: FormData) => {
    if (!cultivation) return;
    try {
      const readings = parseAmbientReadings(String(form.get("payload") || ""));
      const plan = currentPlan(cultivation);
      const events: EventoLecturaAmbiental[] = readings.map((reading) => ({
        id: crearId("evento"),
        tipo: "lectura_ambiental",
        fecha: reading.fecha,
        alcance: { tipo: "cultivo" },
        etapaActiva: cultivation.estado.etapaActiva,
        fuente: { modo: "automatica", equipoId: "sonoff-thr320d", etiqueta: "Sonoff THS01 · importación SonoffLAN" },
        valores: {
          temperaturaAmbiente: { variable: "temperatura_ambiente", valor: reading.temperatura, unidad: "°C" },
          humedad: { variable: "humedad", valor: reading.humedad, unidad: "%" },
          ...(reading.humidificadorEncendido === undefined ? {} : { humidificadorEncendido: { variable: "humidificador_encendido", valor: reading.humidificadorEncendido } }),
        },
      }));
      const alerts: Alerta[] = [...cultivation.alertas];
      const latest = readings.at(-1);
      if (latest && Math.abs(latest.temperatura - plan.temperaturaObjetivoC) >= 2) alerts.push({ id: crearId("alerta"), reglaId: "temperatura-ambiente", severidad: "aviso", titulo: "Temperatura alejada del objetivo", detalle: `${latest.temperatura} °C frente a ${plan.temperaturaObjetivoC} °C objetivo.`, alcance: { tipo: "cultivo" }, creadaEn: latest.fecha, estado: "activa" });
      if (latest && plan.humedadObjetivo && (latest.humedad < plan.humedadObjetivo.minimo || latest.humedad > plan.humedadObjetivo.maximo)) alerts.push({ id: crearId("alerta"), reglaId: "humedad-etapa", severidad: "aviso", titulo: "Humedad fuera del objetivo", detalle: `${latest.humedad}% HR; objetivo de etapa ${plan.humedadObjetivo.minimo}–${plan.humedadObjetivo.maximo}%.`, alcance: { tipo: "cultivo" }, creadaEn: latest.fecha, estado: "activa" });
      await persistCultivation({ ...cultivation, eventos: [...cultivation.eventos, ...events].sort((a, b) => a.fecha.localeCompare(b.fecha)), alertas: alerts, actualizadoEn: new Date().toISOString() });
      if (alerts.length > cultivation.alertas.length && "Notification" in window && Notification.permission === "granted") new Notification("Raíz · Revisá el ambiente", { body: alerts.at(-1)?.detalle });
      setConfigurationOpen(null);
      showToast(`${events.length} lectura${events.length === 1 ? "" : "s"} de Sonoff importada${events.length === 1 ? "" : "s"}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudieron importar las lecturas.", true);
    }
  }, [cultivation, persistCultivation, showToast]);

  const confirmDelete = useCallback(async () => {
    if (!cultivation) return;
    const updated = await deleteCultivation(cultivation.id);
    setState(updated);
    setDeleteOpen(false);
    showToast("Cultivo eliminado del dispositivo.");
  }, [cultivation, showToast]);

  return (
    <>
      <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={(event) => importSelectedFile(event.target.files?.[0])} />
      {!cultivation ? <Welcome onStart={startExample} onImport={() => importInput.current?.click()} onDownload={downloadTemplate} /> : (
        <HydroDashboard
          cultivo={cultivation}
          onMeasure={openMeasurement}
          onQuickAction={openAction}
          onAdvanceWeek={() => setStageOpen(true)}
          onToggleTask={toggleTask}
          onExportBackup={exportCurrent}
          onDownloadTemplate={downloadTemplate}
          onImport={() => importInput.current?.click()}
          onDelete={() => setDeleteOpen(true)}
          onRequestNotifications={requestNotifications}
          onOpenConfiguration={setConfigurationOpen}
        />
      )}

      <MeasurementModal open={measurementOpen} cultivo={cultivation} selectedDwc={selectedDwc} onClose={() => setMeasurementOpen(false)} onSubmit={submitMeasurement} />
      <ActionModal open={actionOpen} cultivo={cultivation} kind={actionKind} selectedDwc={selectedDwc} onClose={() => setActionOpen(false)} onKindChange={setActionKind} onSubmit={submitAction} />
      <StageModal open={stageOpen} cultivo={cultivation} onClose={() => setStageOpen(false)} onConfirm={confirmAdvance} />
      <SystemConfigurationModal open={configurationOpen === "sistema"} cultivo={cultivation} onClose={() => setConfigurationOpen(null)} onSubmit={submitSystemConfiguration} />
      <SonoffImportModal open={configurationOpen === "sonoff"} onClose={() => setConfigurationOpen(null)} onSubmit={submitSonoffReadings} />
      <AlertRulesModal open={configurationOpen === "alertas"} cultivo={cultivation} onClose={() => setConfigurationOpen(null)} onToggle={toggleAlertRule} onNotifications={requestNotifications} />
      <InventoryModal open={configurationOpen === "inventario"} onClose={() => setConfigurationOpen(null)} onSubmit={submitInventoryItem} />
      <Modal open={deleteOpen} title="¿Eliminar este cultivo?" eyebrow="Acción local" size="small" onClose={() => setDeleteOpen(false)}><p>Se eliminarán la configuración y el historial guardados en este navegador. Esta acción no afecta las copias descargadas.</p><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setDeleteOpen(false)}>Cancelar</button><button className="button button-danger" type="button" onClick={confirmDelete}>Eliminar cultivo</button></div></Modal>

      {toast ? <div className="toast-stack"><div className={`toast ${toast.error ? "toast-error" : ""}`}>{toast.error ? <WifiOff size={17} /> : <Check size={17} />}{toast.text}</div></div> : null}
    </>
  );
}

function MeasurementModal({ open, cultivo, selectedDwc, onClose, onSubmit }: { open: boolean; cultivo?: Cultivo; selectedDwc: string; onClose: () => void; onSubmit: (form: FormData) => void }) {
  if (!cultivo) return null;
  const plan = currentPlan(cultivo);
  return <Modal open={open} title="Medir solución" eyebrow="Labymos EZ9902" onClose={onClose}><form action={onSubmit}><div className="form-grid"><div className="field field-full"><label htmlFor="measurement-dwc">DWC</label><select id="measurement-dwc" name="dwcId" defaultValue={selectedDwc}>{cultivo.dwcs.map((dwc) => <option value={dwc.id} key={dwc.id}>{dwc.nombre} · {cultivo.plantas.find((plant) => cultivo.asignaciones.some((assignment) => assignment.dwcId === dwc.id && assignment.plantaId === plant.id && !assignment.fechaFin))?.nombre}</option>)}</select></div><h3 className="form-section-title">Valores de la misma lectura</h3><div className="field"><label htmlFor="ph">pH</label><input id="ph" name="ph" type="number" step="0.1" min="0" max="14" placeholder={String(plan.phObjetivo ?? "5.8")} required /><span className="field-hint">Objetivo actual: {plan.phObjetivo ?? "sin objetivo"}</span></div><div className="field"><label htmlFor="ec">EC (mS/cm)</label><input id="ec" name="ec" type="number" step="0.1" min="0" placeholder={String(plan.ecObjetivo ?? "1.4")} required /><span className="field-hint">Objetivo actual: {plan.ecObjetivo ?? "sin objetivo"}</span></div><div className="field field-full"><label htmlFor="temperature">Temperatura de solución (°C)</label><input id="temperature" name="temperature" type="number" step="0.1" min="0" max="50" placeholder="21.4" required /></div></div><div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Guardar y evaluar</button></div></form></Modal>;
}

function ActionModal({ open, cultivo, kind, selectedDwc, onClose, onKindChange, onSubmit }: { open: boolean; cultivo?: Cultivo; kind: ActionKind; selectedDwc: string; onClose: () => void; onKindChange: (kind: ActionKind) => void; onSubmit: (form: FormData) => void }) {
  if (!cultivo) return null;
  const titles: Record<ActionKind, string> = { agua: "Reponer agua", solucion: "Cambiar solución", observacion: "Observar una planta", nutrientes: "Añadir nutrientes" };
  return <Modal open={open} title={titles[kind]} eyebrow="Registrar acción" onClose={onClose}><form action={onSubmit}><div className="choice-grid">{(["agua", "solucion", "observacion", "nutrientes"] as ActionKind[]).map((item) => <button className={`choice-card ${item === kind ? "choice-card-active" : ""}`} type="button" key={item} onClick={() => onKindChange(item)}><strong>{titles[item]}</strong><small>{item === "agua" ? "Litros añadidos" : item === "solucion" ? "Renovación semanal" : item === "observacion" ? "Nota con contexto" : "Producto y cantidad"}</small></button>)}</div><div className="form-grid" style={{ marginTop: 18 }}>{kind !== "observacion" ? <div className="field field-full"><label htmlFor="action-dwc">DWC</label><select id="action-dwc" name={kind === "solucion" ? "target" : "dwcId"} defaultValue={selectedDwc}>{kind === "solucion" ? <option value="todos">Los cuatro DWC</option> : null}{cultivo.dwcs.map((dwc) => <option value={dwc.id} key={dwc.id}>{dwc.nombre}</option>)}</select></div> : null}{kind === "agua" ? <div className="field field-full"><label htmlFor="liters">Litros añadidos</label><input id="liters" name="liters" type="number" min="0.1" step="0.1" placeholder="1.5" required /></div> : null}{kind === "observacion" ? <><div className="field field-full"><label htmlFor="plantId">Planta</label><select id="plantId" name="plantId">{cultivo.plantas.map((plant) => <option value={plant.id} key={plant.id}>{plant.nombre}</option>)}</select></div><div className="field field-full"><label htmlFor="observation">¿Qué observaste?</label><textarea id="observation" name="observation" placeholder="Hojas, raíces, crecimiento o cualquier cambio…" required /></div></> : null}{kind === "nutrientes" ? <><div className="field"><label htmlFor="productId">Producto</label><select id="productId" name="productId">{cultivo.inventario.filter((item) => item.id.includes("nutriente") || item.id.includes("ph")).map((item) => <option value={item.id} key={item.id}>{item.nombre}</option>)}</select></div><div className="field"><label htmlFor="amount">Cantidad (mL)</label><input id="amount" name="amount" type="number" min="0.1" step="0.1" required /></div></> : null}{kind === "solucion" ? <div className="field field-full"><span className="field-hint">Se registrarán 16 L por DWC y la próxima renovación quedará programada en siete días.</span></div> : null}</div><div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Registrar acción</button></div></form></Modal>;
}

function StageModal({ open, cultivo, onClose, onConfirm }: { open: boolean; cultivo?: Cultivo; onClose: () => void; onConfirm: () => void }) {
  if (!cultivo) return null;
  const next = cultivo.plan.semanas.find((week) => week.semana === cultivo.estado.semanaActiva + 1);
  return <Modal open={open} title={next ? `Avanzar a semana ${next.semana}` : "Plan completado"} eyebrow="Cambio confirmado" size="small" onClose={onClose}>{next ? <><p>Se activará <strong>{next.etapa}</strong> con sus nuevos objetivos, dosis, humedad y fotoperiodo. El historial anterior no se modificará.</p><div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Todavía no</button><button className="button button-primary" type="button" onClick={onConfirm}>Confirmar cambio</button></div></> : <><p>Ya estás en la última semana del plan importado.</p><div className="modal-actions"><button className="button button-primary" type="button" onClick={onClose}>Entendido</button></div></>}</Modal>;
}

function SystemConfigurationModal({ open, cultivo, onClose, onSubmit }: { open: boolean; cultivo?: Cultivo; onClose: () => void; onSubmit: (form: FormData) => void }) {
  if (!cultivo) return null;
  return (
    <Modal open={open} title="Editar sistema" eyebrow="Configuración real" onClose={onClose}>
      <form action={onSubmit}>
        <div className="form-grid">
          <div className="field field-full"><label htmlFor="system-name">Nombre del cultivo</label><input id="system-name" name="name" defaultValue={cultivo.nombre} required /></div>
          <div className="field"><label htmlFor="system-variety">Variedad</label><input id="system-variety" name="variety" defaultValue={cultivo.variedad} required /></div>
          <div className="field"><label htmlFor="system-bank">Banco</label><input id="system-bank" name="bank" defaultValue={cultivo.banco} /></div>
          <h3 className="form-section-title">Espacio y clima</h3>
          <div className="field"><label htmlFor="system-length">Largo (m)</label><input id="system-length" name="length" type="number" step="0.1" min="0.1" defaultValue={cultivo.espacio.largoM} /></div>
          <div className="field"><label htmlFor="system-width">Ancho (m)</label><input id="system-width" name="width" type="number" step="0.1" min="0.1" defaultValue={cultivo.espacio.anchoM} /></div>
          <div className="field"><label htmlFor="system-height">Alto (m)</label><input id="system-height" name="height" type="number" step="0.1" min="0.1" defaultValue={cultivo.espacio.altoM} /></div>
          <div className="field"><label htmlFor="temperature-target">Temperatura objetivo (°C)</label><input id="temperature-target" name="temperatureTarget" type="number" step="0.5" min="10" max="40" defaultValue={currentPlan(cultivo).temperaturaObjetivoC} /></div>
          <h3 className="form-section-title">DWC independientes</h3>
          {cultivo.dwcs.map((dwc) => <div className="field-pair field-full" key={dwc.id}><div className="field"><label htmlFor={`name-${dwc.id}`}>Nombre</label><input id={`name-${dwc.id}`} name={`name-${dwc.id}`} defaultValue={dwc.nombre} /></div><div className="field"><label htmlFor={`volume-${dwc.id}`}>Volumen de trabajo (L)</label><input id={`volume-${dwc.id}`} name={`volume-${dwc.id}`} type="number" step="0.5" min="1" max={dwc.capacidadNominalLitros} defaultValue={dwc.volumenTrabajoLitros} /></div></div>)}
        </div>
        <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Guardar configuración</button></div>
      </form>
    </Modal>
  );
}

function SonoffImportModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (form: FormData) => void }) {
  const sample = `[{\n  "fecha": "${new Date().toISOString()}",\n  "temperatura": 24.2,\n  "humedad": 72,\n  "humidificadorEncendido": true\n}]`;
  return (
    <Modal open={open} title="Importar lecturas Sonoff" eyebrow="Puente local SonoffLAN" onClose={onClose}>
      <form action={onSubmit}>
        <p>Raíz acepta una lectura o un historial JSON exportado por una integración local. La fuente queda identificada como automática y el archivo no sale del navegador.</p>
        <div className="field" style={{ marginTop: 18 }}><label htmlFor="sonoff-payload">Lecturas JSON</label><textarea className="code-input" id="sonoff-payload" name="payload" rows={11} defaultValue={sample} required /><span className="field-hint">Campos compatibles: fecha/timestamp, temperatura/temperature, humedad/humidity y humidificadorEncendido/switch.</span></div>
        <div className="modal-note"><LockKeyhole size={18} /><span><strong>Local-first:</strong> esto permite incorporar el historial sin entregar credenciales de eWeLink. La conexión LAN continua necesitará un puente local compatible con CORS.</span></div>
        <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Importar y evaluar</button></div>
      </form>
    </Modal>
  );
}

function AlertRulesModal({ open, cultivo, onClose, onToggle, onNotifications }: { open: boolean; cultivo?: Cultivo; onClose: () => void; onToggle: (id: string) => void; onNotifications: () => void }) {
  if (!cultivo) return null;
  return (
    <Modal open={open} title="Reglas del asistente" eyebrow="Avisos contextuales" onClose={onClose}>
      <div className="rule-list">{cultivo.reglasAlertas.map((rule) => <label className="rule-row" key={rule.id}><input type="checkbox" checked={rule.activa} onChange={() => onToggle(rule.id)} /><span><strong>{rule.nombre}</strong><small>{rule.descripcion}</small></span><em>{rule.severidad}</em></label>)}</div>
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onNotifications}><Bell size={17} /> Permitir notificaciones</button><button className="button button-primary" type="button" onClick={onClose}>Listo</button></div>
    </Modal>
  );
}

function InventoryModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (form: FormData) => void }) {
  return (
    <Modal open={open} title="Agregar insumo" eyebrow="Inventario local" size="small" onClose={onClose}>
      <form action={onSubmit}><div className="form-grid"><div className="field field-full"><label htmlFor="inventory-name">Nombre</label><input id="inventory-name" name="name" placeholder="Ej. solución de calibración pH 7" required /></div><div className="field"><label htmlFor="inventory-quantity">Cantidad</label><input id="inventory-quantity" name="quantity" type="number" min="0" step="0.1" required /></div><div className="field"><label htmlFor="inventory-unit">Unidad</label><select id="inventory-unit" name="unit"><option value="mL">mL</option><option value="L">L</option><option value="unidad">unidad</option><option value="m">m</option></select></div><div className="field"><label htmlFor="inventory-low">Avisar por debajo de</label><input id="inventory-low" name="lowStock" type="number" min="0" step="0.1" /></div><div className="field field-full"><label htmlFor="inventory-notes">Notas</label><textarea id="inventory-notes" name="notes" placeholder="Marca, uso o ubicación…" /></div></div><div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Agregar</button></div></form>
    </Modal>
  );
}
