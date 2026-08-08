"use client";

import {
  Activity,
  Archive,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CloudSun,
  Download,
  Droplets,
  Gauge,
  History,
  Home,
  Leaf,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  Settings,
  Sprout,
  Thermometer,
  Upload,
  Waves,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Cultivo,
  DWC,
  Evento,
  EventoLecturaAmbiental,
  EventoMedicionSolucion,
  ItemInventario,
  Tarea,
} from "@/lib/cultivo/types";

export type DashboardSection = "resumen" | "plan" | "historial" | "inventario" | "configuracion";

interface HydroDashboardProps {
  cultivo: Cultivo;
  onMeasure: (dwcId?: string) => void;
  onQuickAction: (kind?: string, dwcId?: string) => void;
  onAdvanceWeek: () => void;
  onToggleTask: (taskId: string) => void;
  onExportBackup: () => void;
  onDownloadTemplate: () => void;
  onImport: () => void;
  onDelete: () => void;
  onRequestNotifications: () => void;
  onOpenConfiguration: (panel: "sistema" | "sonoff" | "alertas" | "inventario") => void;
}

const navItems: Array<{ id: DashboardSection; label: string; icon: typeof Home }> = [
  { id: "resumen", label: "Resumen", icon: Home },
  { id: "plan", label: "Plan de cultivo", icon: BookOpen },
  { id: "historial", label: "Historial", icon: History },
  { id: "inventario", label: "Inventario", icon: Package },
  { id: "configuracion", label: "Configuración", icon: Settings },
];

function formatAgo(iso?: string) {
  if (!iso) return "Sin medición";
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days === 1 ? "" : "s"}`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function currentPlan(cultivo: Cultivo) {
  return cultivo.plan.semanas.find((week) => week.semana === cultivo.estado.semanaActiva) ?? cultivo.plan.semanas[0];
}

function lastSolutionMeasurement(cultivo: Cultivo, dwcId: string) {
  return [...cultivo.eventos]
    .reverse()
    .find(
      (event): event is EventoMedicionSolucion =>
        event.tipo === "medicion_solucion" && event.alcance.id === dwcId,
    );
}

function ambientReadings(cultivo: Cultivo) {
  return cultivo.eventos.filter(
    (event): event is EventoLecturaAmbiental => event.tipo === "lectura_ambiental",
  );
}

function plantForDwc(cultivo: Cultivo, dwcId: string) {
  const assignment = cultivo.asignaciones.find((item) => item.dwcId === dwcId && !item.fechaFin);
  return cultivo.plantas.find((plant) => plant.id === assignment?.plantaId);
}

function measurementStatus(measurement?: EventoMedicionSolucion) {
  if (!measurement) return { label: "Pendiente", tone: "neutral" };
  const hours = (Date.now() - new Date(measurement.fecha).getTime()) / 3_600_000;
  if (hours >= 72) return { label: "Atrasada", tone: "danger" };
  if (hours >= 48) return { label: "Medir pronto", tone: "warning" };
  return { label: "Al día", tone: "success" };
}

function eventLabel(event: Evento) {
  const labels: Record<Evento["tipo"], string> = {
    medicion_solucion: "Medición de solución",
    lectura_ambiental: "Lectura ambiental",
    reposicion_agua: "Reposición de agua",
    nutricion: "Nutrientes añadidos",
    cambio_solucion: "Cambio de solución",
    observacion: "Observación",
    etapa: "Cambio de etapa",
    incidencia: "Incidencia",
    correccion_ph: "Corrección de pH",
    mantenimiento: "Mantenimiento",
    inventario: "Movimiento de inventario",
  };
  return labels[event.tipo];
}

function eventSummary(event: Evento) {
  if (event.tipo === "medicion_solucion") {
    const values = [
      event.valores.ph ? `pH ${event.valores.ph.valor}` : null,
      event.valores.ec ? `EC ${event.valores.ec.valor}` : null,
      event.valores.temperaturaSolucion ? `${event.valores.temperaturaSolucion.valor} °C` : null,
    ].filter(Boolean);
    return values.join(" · ");
  }
  if (event.tipo === "lectura_ambiental") return [event.valores.temperaturaAmbiente ? `${event.valores.temperaturaAmbiente.valor} °C` : null, event.valores.humedad ? `${event.valores.humedad.valor}% HR` : null, event.valores.humidificadorEncendido ? (event.valores.humidificadorEncendido.valor ? "Humidificador encendido" : "Humidificador apagado") : null].filter(Boolean).join(" · ");
  if (event.tipo === "reposicion_agua") return `${event.litros} L añadidos`;
  if (event.tipo === "nutricion") return event.productos.map((product) => `${product.nombre}: ${product.cantidad} ${product.unidad}`).join(" · ");
  if (event.tipo === "cambio_solucion") return `${event.volumenLitros} L · ${event.tipoCambio}`;
  if (event.tipo === "observacion") return event.observacion;
  if (event.tipo === "incidencia") return event.titulo;
  if (event.tipo === "etapa") return `${event.etapaAnterior ?? "Inicio"} → ${event.etapaNueva}`;
  return event.notas ?? "Registro guardado";
}

export function HydroDashboard({
  cultivo,
  onMeasure,
  onQuickAction,
  onAdvanceWeek,
  onToggleTask,
  onExportBackup,
  onDownloadTemplate,
  onImport,
  onDelete,
  onRequestNotifications,
  onOpenConfiguration,
}: HydroDashboardProps) {
  const [section, setSection] = useState<DashboardSection>("resumen");
  const [mobileNav, setMobileNav] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const plan = currentPlan(cultivo);
  const ambient = ambientReadings(cultivo);
  const latestAmbient = ambient.at(-1);
  const chartData = ambient.slice(-24).map((reading) => ({
    time: new Date(reading.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    temperatura: Number(reading.valores.temperaturaAmbiente?.valor ?? 0),
    humedad: Number(reading.valores.humedad?.valor ?? 0),
  }));
  const pendingTasks = cultivo.tareas.filter((task) => task.estado === "pendiente");
  const activeAlerts = cultivo.alertas.filter((alert) => alert.estado === "activa");
  const daysSinceStart = Math.max(
    1,
    Math.floor((renderedAt - new Date(cultivo.fechaInicio).getTime()) / 86_400_000) + 1,
  );

  const title = navItems.find((item) => item.id === section)?.label ?? "Resumen";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark"><Sprout size={23} /></span>
          <span><strong>Raíz</strong><small>Asistente hidropónico</small></span>
        </div>
        <button className="mobile-close icon-button" type="button" onClick={() => setMobileNav(false)} aria-label="Cerrar menú">
          <X size={20} />
        </button>

        <div className="cultivo-switcher">
          <span className="avatar-leaf"><Leaf size={18} /></span>
          <span><small>Cultivo activo</small><strong>{cultivo.variedad}</strong></span>
          <MoreHorizontal size={18} />
        </div>

        <nav className="primary-nav" aria-label="Navegación principal">
          <p className="nav-label">Cultivo</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={section === item.id ? "nav-item nav-item-active" : "nav-item"}
                type="button"
                onClick={() => { setSection(item.id); setMobileNav(false); }}
              >
                <Icon size={19} />
                {item.label}
                {item.id === "resumen" && activeAlerts.length ? <span className="nav-badge">{activeAlerts.length}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="local-badge">
            <span className="local-dot" />
            <span><strong>Guardado local</strong><small>Solo en este dispositivo</small></span>
          </div>
        </div>
      </aside>

      {mobileNav ? <button className="nav-scrim" type="button" aria-label="Cerrar menú" onClick={() => setMobileNav(false)} /> : null}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-button icon-button" type="button" onClick={() => setMobileNav(true)} aria-label="Abrir menú"><Menu size={21} /></button>
            <div><p className="eyebrow">{cultivo.nombre}</p><h1>{title}</h1></div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle compact />
            <button className="icon-button notification-button" type="button" onClick={onRequestNotifications} aria-label="Activar notificaciones">
              <Bell size={20} />
              {activeAlerts.length ? <span className="notification-dot" /> : null}
            </button>
            <button className="button button-primary compact" type="button" onClick={() => onMeasure()}>
              <Plus size={18} /> Registrar
            </button>
          </div>
        </header>

        <div className="content-area">
          {section === "resumen" ? (
            <DashboardOverview
              cultivo={cultivo}
              plan={plan}
              daysSinceStart={daysSinceStart}
              latestAmbient={latestAmbient}
              chartData={chartData}
              pendingTasks={pendingTasks}
              onMeasure={onMeasure}
              onQuickAction={onQuickAction}
              onToggleTask={onToggleTask}
              onAdvanceWeek={onAdvanceWeek}
            />
          ) : null}
          {section === "plan" ? <PlanView cultivo={cultivo} onAdvanceWeek={onAdvanceWeek} /> : null}
          {section === "historial" ? <HistoryView cultivo={cultivo} /> : null}
          {section === "inventario" ? <InventoryView items={cultivo.inventario} onAdd={() => onOpenConfiguration("inventario")} /> : null}
          {section === "configuracion" ? (
            <SettingsView
              cultivo={cultivo}
              onExportBackup={onExportBackup}
              onDownloadTemplate={onDownloadTemplate}
              onImport={onImport}
              onDelete={onDelete}
              onOpenConfiguration={onOpenConfiguration}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function DashboardOverview({
  cultivo,
  plan,
  daysSinceStart,
  latestAmbient,
  chartData,
  pendingTasks,
  onMeasure,
  onQuickAction,
  onToggleTask,
  onAdvanceWeek,
}: {
  cultivo: Cultivo;
  plan: ReturnType<typeof currentPlan>;
  daysSinceStart: number;
  latestAmbient?: EventoLecturaAmbiental;
  chartData: Array<{ time: string; temperatura: number; humedad: number }>;
  pendingTasks: Tarea[];
  onMeasure: (dwcId?: string) => void;
  onQuickAction: (kind?: string, dwcId?: string) => void;
  onToggleTask: (taskId: string) => void;
  onAdvanceWeek: () => void;
}) {
  const humidity = latestAmbient?.valores.humedad?.valor;
  const temperature = latestAmbient?.valores.temperaturaAmbiente?.valor;
  const humidifier = latestAmbient?.valores.humidificadorEncendido?.valor;

  return (
    <>
      <section className="stage-hero">
        <div className="stage-copy">
          <div className="stage-kicker"><span className="pulse-dot" /> Cultivo en curso</div>
          <h2>{plan.etapa}</h2>
          <p>Semana {plan.semana} · Día {daysSinceStart} · Cuatro plantas activas</p>
          <div className="stage-tags">
            <span><CloudSun size={15} /> {plan.fotoperiodo} de luz</span>
            <span><Droplets size={15} /> {plan.humedadObjetivo?.minimo}–{plan.humedadObjetivo?.maximo} % HR</span>
            <span><Thermometer size={15} /> {plan.temperaturaObjetivoC} °C</span>
          </div>
        </div>
        <div className="stage-actions">
          <div className="week-progress">
            <span>Progreso del plan</span>
            <strong>{Math.round((plan.semana / 14) * 100)}%</strong>
            <div className="progress-track"><span style={{ width: `${Math.max(2, (plan.semana / 14) * 100)}%` }} /></div>
          </div>
          <button className="button button-light" type="button" onClick={onAdvanceWeek}>
            Avanzar semana <ChevronRight size={17} />
          </button>
        </div>
      </section>

      <section className="quick-actions" aria-label="Acciones rápidas">
        <button type="button" onClick={() => onMeasure()}><span className="quick-icon green"><Gauge size={20} /></span><span><strong>Medir solución</strong><small>pH, EC y temperatura</small></span></button>
        <button type="button" onClick={() => onQuickAction("agua")}><span className="quick-icon blue"><Droplets size={20} /></span><span><strong>Reponer agua</strong><small>Registrar litros</small></span></button>
        <button type="button" onClick={() => onQuickAction("solucion")}><span className="quick-icon purple"><Waves size={20} /></span><span><strong>Cambiar solución</strong><small>Renovación semanal</small></span></button>
        <button type="button" onClick={() => onQuickAction("observacion")}><span className="quick-icon amber"><Leaf size={20} /></span><span><strong>Observar planta</strong><small>Nota o incidencia</small></span></button>
      </section>

      <div className="dashboard-grid">
        <section className="panel climate-panel">
          <div className="panel-header">
            <div><p className="eyebrow">Ambiente compartido</p><h3>Clima de la carpa</h3></div>
            <span className={latestAmbient ? "status-pill success" : "status-pill neutral"}>{latestAmbient ? "Sonoff activo" : "Sin conectar"}</span>
          </div>
          <div className="climate-metrics">
            <div><span className="metric-icon coral"><Thermometer size={21} /></span><p>Temperatura</p><strong>{temperature !== undefined ? `${temperature}°` : "—"}</strong><small>Objetivo 24 °C</small></div>
            <div><span className="metric-icon blue"><Droplets size={21} /></span><p>Humedad</p><strong>{humidity !== undefined ? `${humidity}%` : "—"}</strong><small>Objetivo {plan.humedadObjetivo?.minimo}–{plan.humedadObjetivo?.maximo}%</small></div>
            <div><span className="metric-icon green"><Activity size={21} /></span><p>Humidificador</p><strong className="metric-word">{humidifier === undefined ? "Sin datos" : humidifier ? "Encendido" : "Apagado"}</strong><small>{latestAmbient ? formatAgo(latestAmbient.fecha) : "Pendiente de conexión"}</small></div>
          </div>
          <div className="chart-wrap">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={chartData} margin={{ left: -24, right: 8, top: 12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="humidityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3e9d79" stopOpacity={0.28} /><stop offset="100%" stopColor="#3e9d79" stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e8ece7" strokeDasharray="4 4" />
                  <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#7b877e" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#7b877e" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e4e9e3", boxShadow: "0 12px 30px rgba(20,50,35,.12)" }} />
                  <Area type="monotone" dataKey="humedad" stroke="#287c5e" strokeWidth={2.5} fill="url(#humidityFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart"><Activity size={24} /><strong>Esperando lecturas ambientales</strong><span>El gráfico aparecerá cuando se vincule el Sonoff.</span></div>
            )}
          </div>
        </section>

        <section className="panel tasks-panel">
          <div className="panel-header">
            <div><p className="eyebrow">Rutina</p><h3>Tareas pendientes</h3></div>
            <span className="task-count">{pendingTasks.length}</span>
          </div>
          <div className="task-list">
            {pendingTasks.slice(0, 5).map((task) => (
              <label key={task.id} className="task-row">
                <input type="checkbox" checked={false} onChange={() => onToggleTask(task.id)} />
                <span className="custom-check"><Check size={14} /></span>
                <span><strong>{task.titulo}</strong><small>{task.descripcion ?? formatAgo(task.venceEn)}</small></span>
              </label>
            ))}
            {!pendingTasks.length ? <div className="empty-compact"><Check size={21} /><span>Todo al día por ahora.</span></div> : null}
          </div>
        </section>
      </div>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Unidades independientes</p><h2>Estado de los DWC</h2></div><button className="text-button" type="button" onClick={() => onMeasure()}>Registrar medición <ChevronRight size={16} /></button></div>
        <div className="dwc-grid">
          {cultivo.dwcs.map((dwc) => <DwcCard key={dwc.id} cultivo={cultivo} dwc={dwc} plan={plan} onMeasure={onMeasure} onQuickAction={onQuickAction} />)}
        </div>
      </section>
    </>
  );
}

function DwcCard({ cultivo, dwc, plan, onMeasure, onQuickAction }: { cultivo: Cultivo; dwc: DWC; plan: ReturnType<typeof currentPlan>; onMeasure: (id?: string) => void; onQuickAction: (kind?: string, id?: string) => void }) {
  const measurement = lastSolutionMeasurement(cultivo, dwc.id);
  const plant = plantForDwc(cultivo, dwc.id);
  const status = measurementStatus(measurement);
  return (
    <article className="dwc-card">
      <header><div className="bucket-icon"><Waves size={21} /></div><div><h3>{dwc.nombre}</h3><p>{plant?.nombre ?? "Sin planta"} · {dwc.volumenTrabajoLitros} L</p></div><span className={`status-pill ${status.tone}`}>{status.label}</span></header>
      <div className="dwc-values">
        <div><span>pH</span><strong>{measurement?.valores.ph?.valor ?? "—"}</strong><small>Objetivo {plan.phObjetivo ?? "—"}</small></div>
        <div><span>EC</span><strong>{measurement?.valores.ec?.valor ?? "—"}</strong><small>Objetivo {plan.ecObjetivo ?? "—"}</small></div>
        <div><span>Solución</span><strong>{measurement?.valores.temperaturaSolucion?.valor ? `${measurement.valores.temperaturaSolucion.valor}°` : "—"}</strong><small>{formatAgo(measurement?.fecha)}</small></div>
      </div>
      <footer><button type="button" onClick={() => onMeasure(dwc.id)}><Gauge size={16} /> Medir</button><button type="button" onClick={() => onQuickAction("agua", dwc.id)}><Droplets size={16} /> Reponer</button></footer>
    </article>
  );
}

function PlanView({ cultivo, onAdvanceWeek }: { cultivo: Cultivo; onAdvanceWeek: () => void }) {
  return (
    <section className="page-stack">
      <div className="page-intro"><div><p className="eyebrow">Receta importada</p><h2>Ciclo semana a semana</h2><p>Los objetivos se activan al avanzar el plan. El cambio de etapa siempre requiere confirmación.</p></div><button className="button button-primary" type="button" onClick={onAdvanceWeek}>Avanzar semana <ChevronRight size={17} /></button></div>
      <div className="timeline-list">
        {cultivo.plan.semanas.map((week) => {
          const active = week.semana === cultivo.estado.semanaActiva;
          const completed = week.semana < cultivo.estado.semanaActiva;
          return (
            <article key={week.semana} className={`timeline-card ${active ? "timeline-active" : ""} ${completed ? "timeline-completed" : ""}`}>
              <div className="week-number">{completed ? <Check size={18} /> : week.semana}</div>
              <div className="timeline-main"><span>Semana {week.semana}</span><h3>{week.etapa}</h3><div className="timeline-tags"><span>pH {week.phObjetivo ?? "—"}</span><span>EC {week.ecObjetivo ?? "—"}</span><span>{week.fotoperiodo} luz</span><span>{week.humedadObjetivo?.minimo}–{week.humedadObjetivo?.maximo}% HR</span></div></div>
              <div className="nutrient-list">{week.dosis.length ? week.dosis.map((dose) => <span key={dose.producto}>{dose.producto} <strong>{dose.mililitrosPorLitro} mL/L</strong></span>) : <span>Sin nutrientes</span>}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HistoryView({ cultivo }: { cultivo: Cultivo }) {
  const events = useMemo(() => [...cultivo.eventos].sort((a, b) => b.fecha.localeCompare(a.fecha)), [cultivo.eventos]);
  return (
    <section className="page-stack">
      <div className="page-intro"><div><p className="eyebrow">Trazabilidad local</p><h2>Todo lo que ocurrió</h2><p>Mediciones, acciones y cambios permanecen unidos a su alcance y etapa original.</p></div><span className="large-count">{events.length} eventos</span></div>
      <div className="history-list">
        {events.map((event) => {
          const scopeId = "id" in event.alcance ? event.alcance.id : undefined;
          const scopeName = scopeId ? cultivo.dwcs.find((dwc) => dwc.id === scopeId)?.nombre ?? cultivo.plantas.find((plant) => plant.id === scopeId)?.nombre : undefined;
          return <article className="history-row" key={event.id}><span className="history-icon"><History size={18} /></span><div><p>{eventLabel(event)}</p><strong>{eventSummary(event)}</strong><small>{event.etapaActiva ?? "Sin etapa"} · {formatDate(event.fecha)}</small></div><span className="scope-chip">{event.alcance.tipo}{scopeName ? ` · ${scopeName}` : ""}</span></article>;
        })}
        {!events.length ? <div className="empty-state-inline"><History size={28} /><h3>El historial comienza con tu primera acción</h3><p>Las mediciones y tareas completadas aparecerán aquí.</p></div> : null}
      </div>
    </section>
  );
}

function InventoryView({ items, onAdd }: { items: ItemInventario[]; onAdd: () => void }) {
  return (
    <section className="page-stack">
      <div className="page-intro"><div><p className="eyebrow">Recursos</p><h2>Inventario del cultivo</h2><p>Las acciones de nutrición descuentan el stock automáticamente.</p></div><button className="button button-secondary" type="button" onClick={onAdd}><Plus size={17} /> Agregar insumo</button></div>
      <div className="inventory-grid">
        {items.map((item, index) => {
          const max = item.nombre.toLowerCase().includes("reductor") ? 600 : item.unidad === "L" ? 2 : Math.max(item.cantidad, 1);
          const current = item.unidad === "L" ? item.cantidad : item.cantidad;
          const percent = Math.min(100, (current / max) * 100);
          const tone = ["green", "purple", "amber", "coral"][index % 4];
          return <article className="inventory-card" key={item.id}><div className={`inventory-icon ${tone}`}><Package size={22} /></div><div className="inventory-title"><p>{item.nombre}</p><span className={percent < 20 ? "status-pill warning" : "status-pill success"}>{percent < 20 ? "Stock bajo" : "Disponible"}</span></div><strong>{item.cantidad} <small>{item.unidad}</small></strong><div className="progress-track"><span className={tone} style={{ width: `${percent}%` }} /></div><p className="inventory-note">{item.notas ?? "Sin movimientos recientes"}</p></article>;
        })}
      </div>
    </section>
  );
}

function SettingsView({ cultivo, onExportBackup, onDownloadTemplate, onImport, onDelete, onOpenConfiguration }: { cultivo: Cultivo; onExportBackup: () => void; onDownloadTemplate: () => void; onImport: () => void; onDelete: () => void; onOpenConfiguration: (panel: "sistema" | "sonoff" | "alertas" | "inventario") => void }) {
  const hasAmbientData = cultivo.eventos.some((event) => event.tipo === "lectura_ambiental");
  return (
    <section className="page-stack settings-stack">
      <div className="page-intro"><div><p className="eyebrow">Sistema editable</p><h2>Configuración del ejemplo</h2><p>Creado desde “{cultivo.creadoDesdePlantilla?.nombre ?? "Configuración personalizada"}”.</p></div></div>
      <div className="settings-grid">
        <article className="settings-card"><div className="settings-card-icon"><Sprout size={21} /></div><div><h3>Sistema de cultivo</h3><p>{cultivo.dwcs.length} DWC independientes · {cultivo.espacio.largoM} × {cultivo.espacio.anchoM} × {cultivo.espacio.altoM} m</p></div><button className="text-button" type="button" onClick={() => onOpenConfiguration("sistema")}>Editar <ChevronRight size={16} /></button></article>
        <article className="settings-card"><div className="settings-card-icon"><Activity size={21} /></div><div><h3>SonoffLAN</h3><p>Temperatura, humedad y relé del humidificador.</p><span className={`status-pill ${hasAmbientData ? "success" : "neutral"}`}>{hasAmbientData ? "Con historial" : "Pendiente de conexión"}</span></div><button className="text-button" type="button" onClick={() => onOpenConfiguration("sonoff")}>Importar lecturas <ChevronRight size={16} /></button></article>
        <article className="settings-card"><div className="settings-card-icon"><Bell size={21} /></div><div><h3>Avisos y notificaciones</h3><p>{cultivo.reglasAlertas.filter((rule) => rule.activa).length} reglas activas.</p></div><button className="text-button" type="button" onClick={() => onOpenConfiguration("alertas")}>Configurar <ChevronRight size={16} /></button></article>
      </div>

      <article className="panel sources-panel"><div className="panel-header"><div><p className="eyebrow">Origen de datos</p><h3>Variables y fuentes</h3></div></div><div className="sources-list">{cultivo.fuentesVariables.map((source) => <div key={source.variable}><span>{source.variable}</span><strong className={`source-mode source-${source.fuente.modo}`}>{source.fuente.modo === "automatica" ? "Automática" : source.fuente.modo === "manual" ? "Manual" : "No disponible"}</strong><small>{source.fuente.etiqueta}</small></div>)}</div></article>

      <article className="panel data-panel"><div><p className="eyebrow">Tus datos</p><h3>Importar, exportar y respaldar</h3><p>Todo permanece local. Podés descargar una copia completa o volver a usar la plantilla.</p></div><div className="data-actions"><button className="button button-secondary" type="button" onClick={onExportBackup}><Download size={17} /> Exportar copia</button><button className="button button-secondary" type="button" onClick={onDownloadTemplate}><Archive size={17} /> Descargar plantilla</button><button className="button button-secondary" type="button" onClick={onImport}><Upload size={17} /> Importar archivo</button></div></article>

      <article className="danger-zone"><div><h3>Eliminar cultivo local</h3><p>Descargá una copia si querés conservar el historial.</p></div><button className="button button-danger" type="button" onClick={onDelete}>Eliminar</button></article>
    </section>
  );
}
