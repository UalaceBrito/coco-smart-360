"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  CloudSun,
  Droplets,
  FileText,
  FlaskConical,
  FolderKanban,
  Gauge,
  Leaf,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Settings2,
  Sprout,
  TreePalm,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import type { FormEvent, ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";

import { apiRequest } from "@/lib/api";
import type {
  AgronomicReferences,
  Farm,
  FertilizationApplication,
  FertilizerCalculation,
  Harvest,
  Health,
  InventoryItem,
  IrrigationCalculation,
  IrrigationEvent,
  SoilAnalysis,
  Task,
  Tree,
  Workspace,
} from "@/lib/types";

type Section =
  | "dashboard"
  | "property"
  | "trees"
  | "calendar"
  | "nutrition"
  | "irrigation"
  | "inventory"
  | "harvest";

const navigation: Array<{
  id: Section;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "property", label: "Minha propriedade", icon: FolderKanban },
  { id: "trees", label: "Coqueiros", icon: TreePalm },
  { id: "calendar", label: "Calendário de manejo", icon: CalendarDays },
  { id: "nutrition", label: "Solo e adubação", icon: FlaskConical },
  { id: "irrigation", label: "Irrigação", icon: Droplets },
  { id: "inventory", label: "Estoque", icon: Package },
  { id: "harvest", label: "Colheita e custos", icon: Wallet },
];

const sectionTitles: Record<Section, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Visão geral",
    subtitle: "Acompanhe os registros e as próximas ações da propriedade.",
  },
  property: {
    title: "Minha propriedade",
    subtitle: "Dados cadastrais e contexto do coqueiral.",
  },
  trees: {
    title: "Coqueiros",
    subtitle: "Cadastro individual e identificação das plantas.",
  },
  calendar: {
    title: "Calendário de manejo",
    subtitle: "Organize e acompanhe as atividades da propriedade.",
  },
  nutrition: {
    title: "Solo e adubação",
    subtitle: "Registre laudos e faça cálculos a partir de planos já validados.",
  },
  irrigation: {
    title: "Irrigação assistida",
    subtitle: "Estimativas hídricas sem acionamento de bombas ou válvulas.",
  },
  inventory: {
    title: "Estoque",
    subtitle: "Controle entradas, composição, lotes e validade de insumos.",
  },
  harvest: {
    title: "Colheita e custos",
    subtitle: "Registre a produção e acompanhe a receita informada.",
  },
};

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

function readForm(form: HTMLFormElement): Record<string, unknown> {
  const data = new FormData(form);
  const result: Record<string, unknown> = {};
  for (const [key, value] of data.entries()) {
    if (typeof value === "string" && value.trim() !== "" && key !== "reviewed") {
      result[key] = value.trim();
    }
  }
  return result;
}

function parseNumbers(
  payload: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  for (const field of fields) {
    if (payload[field] !== undefined) {
      payload[field] = Number(payload[field]);
    }
  }
  return payload;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function todayInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function shortDateInput(daysFromNow = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  min,
  max,
  step,
  defaultValue,
  help,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
  defaultValue?: string | number;
  help?: string;
}) {
  return (
    <label className="field">
      <span>{label}{required && <b className="required-mark"> *</b>}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
      />
      {help && <small>{help}</small>}
    </label>
  );
}

function SelectField({
  label,
  name,
  children,
  required = false,
  defaultValue,
}: {
  label: string;
  name: string;
  children: ReactNode;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="field">
      <span>{label}{required && <b className="required-mark"> *</b>}</span>
      <select name={name} required={required} defaultValue={defaultValue ?? ""}>
        {children}
      </select>
    </label>
  );
}

function SubmitButton({
  children,
  busy,
}: {
  children: ReactNode;
  busy: boolean;
}) {
  return (
    <button className="button button-primary" type="submit" disabled={busy}>
      {busy ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
      {busy ? "Salvando..." : children}
    </button>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof CircleHelp;
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={20} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function StatusBadge({ task }: { task: Task }) {
  const label =
    task.status === "done"
      ? "Concluída"
      : task.status === "in_progress"
        ? "Em andamento"
        : task.status === "rescheduled"
          ? "Reprogramada"
          : "Pendente";
  return <span className={`status-badge status-${task.status}`}>{label}</span>;
}

function subscribeToOnlineStatus(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function getOnlineStatus() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function subscribeToStaticStatus() {
  return () => {};
}

function getOfflineSupportAvailability() {
  return (
    typeof window === "undefined" ||
    (window.isSecureContext && "serviceWorker" in navigator)
  );
}

function getServerStatus() {
  return true;
}

export default function Home() {
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [section, setSection] = useState<Section>("dashboard");
  const [saving, setSaving] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatus,
    getServerStatus,
  );
  const offlineSupportAvailable = useSyncExternalStore(
    subscribeToStaticStatus,
    getOfflineSupportAvailability,
    getServerStatus,
  );
  const [operationError, setOperationError] = useState("");
  const [notice, setNotice] = useState("");
  const [fertilizerResult, setFertilizerResult] =
    useState<FertilizerCalculation | null>(null);
  const [irrigationResult, setIrrigationResult] =
    useState<IrrigationCalculation | null>(null);
  const { mutate: mutateCache } = useSWRConfig();
  const {
    data: health,
    error: healthError,
    isLoading: healthLoading,
    mutate: mutateHealth,
  } = useSWR<Health, Error>("/health", apiFetcher<Health>);
  const {
    data: farmData,
    error: farmsError,
    isLoading: farmsLoading,
    mutate: mutateFarms,
  } = useSWR<Farm[], Error>("/api/v1/farms", apiFetcher<Farm[]>);
  const {
    data: referencesData,
    error: referencesError,
    isLoading: referencesLoading,
    mutate: mutateReferences,
  } = useSWR<AgronomicReferences, Error>(
    "/api/v1/agronomic-references",
    apiFetcher<AgronomicReferences>,
  );
  const farms = farmData ?? [];
  const activeFarmId = selectedFarmId ?? farmData?.[0]?.id ?? null;
  const workspaceKey = activeFarmId
    ? `/api/v1/workspace?farm_id=${activeFarmId}`
    : null;
  const {
    data: workspaceData,
    error: workspaceError,
    isLoading: workspaceLoading,
  } = useSWR<Workspace, Error>(workspaceKey, apiFetcher<Workspace>);
  const workspace = workspaceData ?? null;
  const references = referencesData ?? null;
  const loading =
    healthLoading ||
    farmsLoading ||
    referencesLoading ||
    Boolean(activeFarmId && workspaceLoading) ||
    refreshing;
  const queryError =
    farmsError?.message ??
    referencesError?.message ??
    workspaceError?.message ??
    "";
  const apiError = operationError || queryError;
  const offlineMode = !isOnline || Boolean(healthError);
  const connectionState = offlineMode
    ? "offline"
    : apiError
      ? "disconnected"
      : loading
        ? "connecting"
        : "connected";
  const connectionLabel = offlineMode
    ? "Modo offline · consulta"
    : apiError
      ? "API desconectada"
      : loading
        ? "Conectando"
        : "API conectada";
  const activeSection = sectionTitles[section];

  async function refreshData(farmId = activeFarmId) {
    setRefreshing(true);
    setOperationError("");
    try {
      await Promise.all([
        mutateHealth(),
        mutateFarms(),
        mutateReferences(),
        farmId
          ? mutateCache(`/api/v1/workspace?farm_id=${farmId}`)
          : Promise.resolve(),
      ]);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Falha ao atualizar os dados.");
    } finally {
      setRefreshing(false);
    }
  }

  async function submitForm(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    numericFields: string[],
    successMessage: string,
    options: { includeFarmId?: boolean } = {},
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = parseNumbers(readForm(form), numericFields);
    if (formData.has("reviewed")) payload.reviewed = true;
    if (options.includeFarmId !== false && activeFarmId !== null) {
      payload.farm_id = activeFarmId;
    }
    setSaving(true);
    setOperationError("");
    setNotice("");
    try {
      const created = await apiRequest<Farm>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      setNotice(successMessage);
      if (endpoint === "/api/v1/farms") setSelectedFarmId(created.id);
      await refreshData(endpoint === "/api/v1/farms" ? created.id : activeFarmId);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  }

  async function calculate(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    numericFields: string[],
    kind: "fertilizer" | "irrigation",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = parseNumbers(readForm(form), numericFields);
    setOperationError("");
    setNotice("");
    try {
      if (kind === "fertilizer") {
        setFertilizerResult(
          await apiRequest<FertilizerCalculation>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
          }),
        );
      } else {
        setIrrigationResult(
          await apiRequest<IrrigationCalculation>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
          }),
        );
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Não foi possível realizar o cálculo.");
    }
  }

  async function updateTask(task: Task) {
    setOperationError("");
    setNotice("");
    try {
      await apiRequest<Task>(`/api/v1/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: task.status === "done" ? "pending" : "done",
        }),
      });
      setNotice(task.status === "done" ? "Atividade reaberta." : "Atividade concluída.");
      await refreshData();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Não foi possível atualizar a atividade.");
    }
  }

  async function seedDemo() {
    setDemoBusy(true);
    setOperationError("");
    setNotice("");
    try {
      const result = await apiRequest<{ farm_id: number; is_demo: boolean; created: boolean }>(
        "/api/v1/demo/seed",
        { method: "POST" },
      );
      setSelectedFarmId(result.farm_id);
      setNotice(
        result.created
          ? "Dados ilustrativos carregados. A propriedade está identificada como demonstração."
          : "A propriedade demonstrativa já estava carregada.",
      );
      await refreshData(result.farm_id);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Não foi possível carregar a demonstração.");
    } finally {
      setDemoBusy(false);
    }
  }

  const farm = workspace?.farm ?? null;
  const taskList = workspace?.tasks ?? [];

  function renderSection() {
    if (loading && !workspace) {
      return (
        <div className="loading-card">
          <LoaderCircle className="spin" size={22} />
          <span>Conectando à propriedade...</span>
        </div>
      );
    }
    if (!farm && section !== "property") {
      return (
        <Panel title="Comece cadastrando sua propriedade" subtitle="Os registros ficam no seu banco local.">
          <EmptyState
            icon={Sprout}
            title="Ainda não há uma propriedade cadastrada"
            detail="Cadastre as informações básicas para habilitar o painel, o calendário e os demais módulos."
          />
          <button className="button button-primary empty-action" onClick={() => setSection("property")}>
            Cadastrar propriedade <ArrowRight size={16} />
          </button>
          {health?.demo_mode && (
            <button className="button button-secondary empty-action" onClick={seedDemo} disabled={demoBusy}>
              {demoBusy ? <LoaderCircle className="spin" size={16} /> : <Activity size={16} />}
              Carregar dados de demonstração
            </button>
          )}
        </Panel>
      );
    }

    switch (section) {
      case "dashboard":
        return (
          <DashboardSection
            workspace={workspace}
            onNavigate={setSection}
            onTaskUpdate={updateTask}
            onDemo={seedDemo}
            demoEnabled={Boolean(health?.demo_mode)}
            demoBusy={demoBusy}
          />
        );
      case "property":
        return (
          <PropertySection
            farm={farm}
            busy={saving}
            onSubmit={(event) =>
              submitForm(
                event,
                "/api/v1/farms",
                ["total_area_ha", "cultivated_area_ha", "planted_tree_count"],
                "Propriedade cadastrada.",
                { includeFarmId: false },
              )
            }
          />
        );
      case "trees":
        return (
          <TreesSection
            workspace={workspace}
            busy={saving}
            onSubmit={(event) =>
              submitForm(
                event,
                "/api/v1/trees",
                ["row_number", "position_number", "latitude", "longitude"],
                "Coqueiro cadastrado.",
              )
            }
          />
        );
      case "calendar":
        return (
          <CalendarSection
            tasks={taskList}
            trees={workspace?.trees ?? []}
            busy={saving}
            onSubmit={(event) =>
              submitForm(
                event,
                "/api/v1/tasks",
                ["tree_id"],
                "Atividade adicionada ao calendário.",
              )
            }
            onTaskUpdate={updateTask}
          />
        );
      case "nutrition":
        return (
          <NutritionSection
            workspace={workspace}
            references={references}
            busy={saving}
            result={fertilizerResult}
            onSoilSubmit={(event) =>
              submitForm(
                event,
                "/api/v1/soil-analyses",
                [
                  "ph",
                  "organic_matter_pct",
                  "phosphorus_mg_dm3",
                  "potassium_mg_dm3",
                  "calcium_cmolc_dm3",
                  "magnesium_cmolc_dm3",
                  "aluminum_cmolc_dm3",
                  "ctc_cmolc_dm3",
                  "base_saturation_pct",
                ],
                "Análise de solo registrada.",
              )
            }
            onApplicationSubmit={(event) =>
              submitForm(
                event,
                "/api/v1/fertilization-applications",
                ["tree_id", "quantity_kg"],
                "Aplicação registrada no histórico.",
              )
            }
            onCalculate={(event) =>
              calculate(
                event,
                "/api/v1/calculations/fertilizer",
                [
                  "target_n_g_per_tree",
                  "target_p2o5_g_per_tree",
                  "target_k2o_g_per_tree",
                  "composition_n_pct",
                  "composition_p2o5_pct",
                  "composition_k2o_pct",
                  "tree_count",
                  "package_kg",
                  "price_per_package",
                ],
                "fertilizer",
              )
            }
          />
        );
      case "irrigation":
        return (
          <IrrigationSection
            workspace={workspace}
            busy={saving}
            result={irrigationResult}
            onCalculate={(event) =>
              calculate(
                event,
                "/api/v1/calculations/irrigation",
                [
                  "eto_mm_day",
                  "kc",
                  "effective_rain_mm_day",
                  "efficiency_percent",
                  "area_ha",
                  "tree_count",
                  "emitters_per_tree",
                  "flow_liters_per_hour",
                ],
                "irrigation",
              )
            }
            onEventSubmit={(event) =>
              submitForm(
                event,
                "/api/v1/irrigation-events",
                ["volume_liters", "runtime_minutes", "area_ha"],
                "Irrigação registrada.",
              )
            }
          />
        );
      case "inventory":
        return (
          <InventorySection
            items={workspace?.inventory ?? []}
            busy={saving}
            onSubmit={(event) =>
              submitForm(
                event,
                "/api/v1/inventory",
                ["quantity", "unit_cost", "n_pct", "p2o5_pct", "k2o_pct"],
                "Insumo adicionado ao estoque.",
              )
            }
          />
        );
      case "harvest":
        return (
          <HarvestSection
            workspace={workspace}
            busy={saving}
            onSubmit={(event) =>
              submitForm(
                event,
                "/api/v1/harvests",
                ["tree_id", "fruits_harvested", "fruits_discarded", "weight_kg", "price_per_fruit"],
                "Colheita registrada.",
              )
            }
          />
        );
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><TreePalm size={24} strokeWidth={2.2} /></div>
          <div>
            <strong>COCO SMART <span>360</span></strong>
            <small>INTELLIGENT FARMING</small>
          </div>
        </div>
        <div className="farm-switcher">
          <div className="farm-switcher-icon"><Sprout size={16} /></div>
          <label>
            <span>PROPRIEDADE ATIVA</span>
            <select
              aria-label="Selecionar propriedade"
              value={activeFarmId ?? ""}
              onChange={(event) => {
                const nextId = Number(event.target.value);
                setSelectedFarmId(Number.isFinite(nextId) && nextId > 0 ? nextId : null);
              }}
            >
              {farms.length === 0 && <option value="">Nenhuma cadastrada</option>}
              {farms.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <ChevronDown size={14} className="switcher-chevron" />
        </div>
        <nav className="navigation" aria-label="Navegação principal">
          <span className="nav-caption">GESTÃO DA PROPRIEDADE</span>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${section === id ? "active" : ""}`}
              onClick={() => setSection(id)}
              aria-label={label}
              aria-current={section === id ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "calendar" && workspace?.dashboard.pending_tasks ? (
                <b className="nav-count">{workspace.dashboard.pending_tasks}</b>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card">
            <div className="offline-icon"><CloudSun size={18} /></div>
            <div>
              <strong>Clima não conectado</strong>
              <span>Sem dados meteorológicos simulados</span>
            </div>
          </div>
          <div className="sidebar-profile">
            <div className="profile-avatar">CS</div>
            <div className="profile-copy">
              <strong>Produtor</strong>
              <span>Área de trabalho local</span>
            </div>
            <Settings2 size={17} className="profile-settings" />
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>COCO SMART 360</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{activeSection.title}</strong>
          </div>
          <div className="topbar-actions">
            <div className={`api-indicator ${connectionState}`}>
              <i />
              <span>{connectionLabel}</span>
            </div>
            <button
              className="icon-button"
              aria-label="Atualizar dados"
              onClick={() => void refreshData()}
              disabled={loading}
            >
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">PAINEL DE GESTÃO</p>
              <h1>{activeSection.title}</h1>
              <p className="page-subtitle">{activeSection.subtitle}</p>
            </div>
            <div className="heading-date">
              <CalendarDays size={16} />
              <span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}</span>
            </div>
          </div>

          {offlineMode && (
            <div className="offline-banner" role="status">
              <CircleAlert size={17} />
              <div>
                <strong>Modo offline — somente consulta</strong>
                <span>
                  {offlineSupportAvailable
                    ? "Dados já carregados podem ser consultados. Cadastros e alterações só serão salvos quando a conexão voltar."
                    : "Este endereço HTTP não permite abrir o app sem conexão. Reconecte-se e use um endereço HTTPS; alterações não foram salvas."}
                </span>
              </div>
            </div>
          )}

          {!offlineSupportAvailable && isOnline && !offlineMode && (
            <div className="offline-banner" role="status">
              <CircleAlert size={17} />
              <div>
                <strong>Offline requer uma conexão HTTPS</strong>
                <span>Este endereço HTTP funciona online, mas não permite guardar a tela para abrir o app sem conexão.</span>
              </div>
            </div>
          )}

          {workspace?.farm.is_demo && (
            <div className="demo-banner">
              <Activity size={17} />
              <div>
                <strong>Modo demonstração — dados fictícios</strong>
                <span>Use apenas para conhecer a interface. Esses registros não representam dados reais nem recomendação técnica.</span>
              </div>
              <span className="demo-chip">DEMO</span>
            </div>
          )}

          {apiError && (
            <div className="alert alert-error" role="alert">
              <CircleAlert size={18} />
              <div><strong>Não foi possível concluir a operação</strong><span>{apiError}</span></div>
              <button className="alert-close" aria-label="Fechar" onClick={() => setOperationError("")}><X size={16} /></button>
            </div>
          )}
          {notice && (
            <div className="alert alert-success" role="status">
              <CheckCircle2 size={18} />
              <span>{notice}</span>
              <button className="alert-close" aria-label="Fechar" onClick={() => setNotice("")}><X size={16} /></button>
            </div>
          )}

          {renderSection()}
          <footer className="page-footer">
            <span>COCO SMART 360 <b>•</b> MVP local</span>
            <span>© Uálace Brito 2026</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function DashboardSection({
  workspace,
  onNavigate,
  onTaskUpdate,
  onDemo,
  demoEnabled,
  demoBusy,
}: {
  workspace: Workspace | null;
  onNavigate: (section: Section) => void;
  onTaskUpdate: (task: Task) => void;
  onDemo: () => void;
  demoEnabled: boolean;
  demoBusy: boolean;
}) {
  if (!workspace) {
    return (
      <div className="dashboard-grid">
        <Panel title="Bem-vindo ao seu COCO SMART 360" subtitle="Comece conectando a gestão aos dados da propriedade.">
          <div className="welcome-panel">
            <div className="welcome-art"><TreePalm size={72} strokeWidth={1.25} /></div>
            <div className="welcome-copy">
              <span className="welcome-label"><Leaf size={14} /> INTELIGÊNCIA EM CADA COQUEIRO</span>
              <h2>Seu coqueiral, organizado em um só lugar.</h2>
              <p>Cadastre a propriedade e registre plantas, atividades, análises, irrigação e produção. As recomendações agronômicas continuam sob validação profissional.</p>
              <div className="welcome-actions">
                <button className="button button-primary" onClick={() => onNavigate("property")}>
                  <Plus size={16} /> Cadastrar propriedade
                </button>
                {demoEnabled && (
                  <button className="button button-secondary" onClick={onDemo} disabled={demoBusy}>
                    {demoBusy ? <LoaderCircle className="spin" size={16} /> : <Activity size={16} />}
                    Testar com dados de demonstração
                  </button>
                )}
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="Comece por aqui" subtitle="A sequência inicial ajuda a manter os registros organizados.">
          <div className="getting-started">
            {[
              ["01", "Cadastre a propriedade", "Município, área e variedade"],
              ["02", "Registre os coqueiros", "Identificadores e localização"],
              ["03", "Adicione atividades", "Datas, responsáveis e conclusão"],
            ].map(([number, title, detail]) => (
              <div className="getting-step" key={number}>
                <span>{number}</span><div><strong>{title}</strong><small>{detail}</small></div><ArrowRight size={15} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  const { dashboard, farm, tasks, trees, harvests } = workspace;
  const openTasks = tasks.filter((task) => task.status !== "done").slice(0, 5);
  const latestHarvest = harvests[0];
  const stats = [
    {
      label: "Coqueiros informados",
      value: formatNumber(farm.planted_tree_count, 0),
      detail: `${formatNumber(dashboard.tree_count, 0)} com ficha individual`,
      icon: TreePalm,
      tone: "green",
      change: null,
    },
    {
      label: "Manejo pendente",
      value: formatNumber(dashboard.pending_tasks, 0),
      detail: dashboard.overdue_tasks ? `${dashboard.overdue_tasks} atrasadas` : "Nenhuma atividade atrasada",
      icon: CalendarDays,
      tone: dashboard.overdue_tasks ? "amber" : "blue",
      change: dashboard.overdue_tasks ? "Atenção" : null,
    },
    {
      label: "Amostras de solo",
      value: formatNumber(dashboard.soil_sample_count, 0),
      detail: dashboard.soil_sample_count ? "registros armazenados" : "Ainda sem laudos",
      icon: FlaskConical,
      tone: "purple",
      change: null,
    },
    {
      label: "Colheita no mês",
      value: formatNumber(dashboard.harvested_fruits_this_month, 0),
      detail: "frutos registrados",
      icon: Sprout,
      tone: "teal",
      change: null,
    },
  ];

  return (
    <>
      <div className="dashboard-grid">
        <div className="dashboard-main-column">
          <section className="welcome-card">
            <div className="welcome-glow" />
            <div className="welcome-content">
              <div className="welcome-label"><Sprout size={14} /> PROPRIEDADE ATIVA</div>
              <h2>{farm.name}</h2>
              <p><MapPin size={14} /> {farm.municipality} — {farm.state} <span>•</span> {formatNumber(farm.cultivated_area_ha)} ha cultivados</p>
              <div className="welcome-meta">
                <span><TreePalm size={14} /> {farm.variety || "Variedade não informada"}</span>
                <span><Activity size={14} /> {trees.length} plantas individualizadas</span>
              </div>
            </div>
            <div className="welcome-illustration">
              <Image
              src="/images/belas-aguas-loaded-coconut.jpg"
              alt="Coqueiro-anão verde carregado de cocos"
                fill
                priority
              sizes="(max-width: 650px) 104px, 220px"
              className="welcome-coconut-photo"
              />
            </div>
          </section>

          <div className="stat-grid">
            {stats.map(({ label, value, detail, icon: Icon, tone, change }) => (
              <div className="stat-card" key={label}>
                <div className={`stat-icon icon-${tone}`}><Icon size={18} /></div>
                {change && <span className="stat-tag"><ArrowUpRight size={12} /> {change}</span>}
                <span className="stat-label">{label}</span>
                <strong className="stat-value">{value}</strong>
                <span className="stat-detail">{detail}</span>
              </div>
            ))}
          </div>

          <Panel
            title="Próximas atividades"
            subtitle="Tarefas registradas no calendário da propriedade."
            action={<button className="text-button" onClick={() => onNavigate("calendar")}>Ver calendário <ArrowRight size={14} /></button>}
          >
            {openTasks.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nenhuma atividade pendente" detail="Adicione tarefas para planejar o manejo da propriedade." />
            ) : (
              <div className="task-list compact">
                {openTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onUpdate={onTaskUpdate} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="dashboard-side-column">
          <Panel title="Indicadores" subtitle="Resumo dos dados registrados.">
            <div className="indicator-list">
              <div className="indicator-item">
                <div className="indicator-icon icon-blue"><Droplets size={17} /></div>
                <div><span>Água registrada · 30 dias</span><strong>{formatNumber(dashboard.irrigation_liters_30d, 0)} L</strong></div>
                <ArrowUpRight size={14} className="muted-icon" />
              </div>
              <div className="indicator-item">
                <div className="indicator-icon icon-green"><Package size={17} /></div>
                <div><span>Itens no estoque</span><strong>{dashboard.inventory_item_count} registros</strong></div>
                <ArrowRight size={14} className="muted-icon" />
              </div>
              <div className="indicator-item">
                <div className="indicator-icon icon-amber"><Wallet size={17} /></div>
                <div><span>Receita estimada · mês</span><strong>{formatCurrency(dashboard.estimated_harvest_revenue_this_month)}</strong></div>
                <ArrowDownRight size={14} className="muted-icon" />
              </div>
              <div className="indicator-item">
                <div className="indicator-icon icon-purple"><Gauge size={17} /></div>
                <div><span>Saúde da propriedade</span><strong className="not-assessed">Não avaliada</strong></div>
                <CircleHelp size={14} className="muted-icon" />
              </div>
            </div>
            <div className="quality-note"><CircleHelp size={14} /> Nenhum indicador de saúde é calculado sem dados e validação suficientes.</div>
          </Panel>

          <Panel title="Clima da propriedade" subtitle="Origem externa não configurada.">
            <div className="weather-unavailable">
              <div className="weather-icon"><CloudSun size={28} /></div>
              <div>
                <strong>Dados meteorológicos indisponíveis</strong>
                <p>Conecte uma fonte confiável para consultar previsão e ETo. Não exibimos valores simulados como clima real.</p>
              </div>
            </div>
          </Panel>

          <Panel title="Última colheita" subtitle="Conforme registros da propriedade.">
            {latestHarvest ? (
              <div className="harvest-highlight">
                <div className="harvest-highlight-number">
                  <strong>{formatNumber(latestHarvest.fruits_harvested, 0)}</strong><span>frutos</span>
                </div>
                <div className="harvest-highlight-info">
                  <span>{formatDate(latestHarvest.harvested_on)}</span>
                  <strong>{latestHarvest.destination || "Destinação não informada"}</strong>
                  <small>{latestHarvest.weight_kg ? `${formatNumber(latestHarvest.weight_kg)} kg registrados` : "Peso não informado"}</small>
                </div>
                <button className="icon-button small" aria-label="Abrir colheita" onClick={() => onNavigate("harvest")}><ArrowRight size={15} /></button>
              </div>
            ) : (
              <EmptyState icon={Sprout} title="Sem colheitas registradas" detail="Os dados de produção aparecerão aqui após o primeiro registro." />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function TaskRow({
  task,
  onUpdate,
}: {
  task: Task;
  onUpdate: (task: Task) => void;
}) {
  const overdue = task.status !== "done" && task.due_date < todayInput();
  return (
    <div className={`task-row ${task.status === "done" ? "task-complete" : ""}`}>
      <button
        className={`task-check ${task.status === "done" ? "checked" : ""}`}
        aria-label={task.status === "done" ? "Reabrir atividade" : "Concluir atividade"}
        onClick={() => onUpdate(task)}
      >
        {task.status === "done" && <Check size={13} />}
      </button>
      <div className="task-copy">
        <strong>{task.title}</strong>
        <span>{task.description || "Sem detalhes adicionais"}</span>
      </div>
      <span className={`task-due ${overdue ? "overdue" : ""}`}>{overdue ? "Atrasada · " : ""}{formatDate(task.due_date)}</span>
      <StatusBadge task={task} />
    </div>
  );
}

function PropertySection({
  farm,
  busy,
  onSubmit,
}: {
  farm: Farm | null;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="content-grid">
      <Panel title={farm ? "Dados da propriedade ativa" : "Cadastrar propriedade"} subtitle="Use dados confirmados pelo produtor; campos opcionais podem ser preenchidos depois.">
        {farm && (
          <div className="property-summary">
            <div className="property-summary-mark"><Sprout size={22} /></div>
            <div><strong>{farm.name}</strong><span>{farm.municipality} — {farm.state}</span></div>
            {farm.is_demo && <span className="demo-chip">DEMO</span>}
          </div>
        )}
        <form className="form-grid" onSubmit={onSubmit}>
          <Field label="Nome da propriedade" name="name" required placeholder="Ex.: Sítio Boa Água" />
          <Field label="Município" name="municipality" required placeholder="Município" />
          <Field label="Estado (UF)" name="state" required placeholder="BA" />
          <Field label="Área total (ha)" name="total_area_ha" type="number" min={0} step="0.01" required />
          <Field label="Área cultivada (ha)" name="cultivated_area_ha" type="number" min={0} step="0.01" required />
          <Field
            label="Total de coqueiros informado"
            name="planted_tree_count"
            type="number"
            min={0}
            step={1}
            required
            help="A quantidade informada não cria fichas individuais automaticamente."
          />
          <SelectField label="Variedade principal" name="variety">
            <option value="">Não informada</option>
            <option value="Anão verde">Coqueiro-anão verde</option>
            <option value="Anão amarelo">Coqueiro-anão amarelo</option>
            <option value="Anão vermelho">Coqueiro-anão vermelho</option>
            <option value="Gigante">Coqueiro-gigante</option>
            <option value="Híbrido">Coqueiro-híbrido</option>
            <option value="Outra">Outra / cadastrável</option>
          </SelectField>
          <div className="form-submit full-width">
            <SubmitButton busy={busy}>{farm ? "Adicionar propriedade" : "Salvar propriedade"}</SubmitButton>
          </div>
        </form>
      </Panel>
      <div className="stacked-panels">
        <Panel title="Dados cadastrados" subtitle="Resumo sem interpretação agronômica automática.">
          {farm ? (
            <div className="detail-list">
              <Detail label="Localização" value={`${farm.municipality} — ${farm.state}`} />
              <Detail label="Área total" value={`${formatNumber(farm.total_area_ha)} ha`} />
              <Detail label="Área cultivada" value={`${formatNumber(farm.cultivated_area_ha)} ha`} />
              <Detail label="Coqueiros informados" value={formatNumber(farm.planted_tree_count, 0)} />
              <Detail label="Variedade" value={farm.variety || "Não informada"} />
              <Detail label="Atualização" value={formatDate(farm.created_at)} />
            </div>
          ) : (
            <EmptyState icon={FolderKanban} title="Nenhuma propriedade ativa" detail="Preencha o cadastro para iniciar os registros." />
          )}
        </Panel>
        <Panel title="Dados que podem ser adicionados depois" subtitle="O cadastro inicial pode ser complementado.">
          <div className="tag-cloud">
            {["GPS", "Espaçamento", "Água", "Irrigação", "Solo", "Histórico", "Objetivos"].map((item) => <span key={item}>{item}</span>)}
          </div>
          <p className="panel-footnote">O MVP não infere informações ausentes nem gera um plano de manejo automático.</p>
        </Panel>
      </div>
    </div>
  );
}

function TreesSection({
  workspace,
  busy,
  onSubmit,
}: {
  workspace: Workspace | null;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const trees = workspace?.trees ?? [];
  return (
    <div className="content-grid">
      <Panel title="Novo coqueiro" subtitle="Cada planta recebe um identificador exclusivo dentro da propriedade.">
        <form className="form-grid" onSubmit={onSubmit}>
          <Field label="Identificador" name="identifier" required placeholder="Ex.: QD-01-001" />
          <Field label="Data de plantio" name="planted_at" type="date" />
          <Field label="Variedade" name="variety" placeholder={workspace?.farm.variety || "Não informada"} />
          <Field label="Linha" name="row_number" type="number" min={1} step={1} />
          <Field label="Posição" name="position_number" type="number" min={1} step={1} />
          <Field label="Latitude" name="latitude" type="number" min={-90} max={90} step="any" />
          <Field label="Longitude" name="longitude" type="number" min={-180} max={180} step="any" />
          <div className="form-submit full-width"><SubmitButton busy={busy}>Cadastrar coqueiro</SubmitButton></div>
        </form>
      </Panel>
      <Panel title="Plantas cadastradas" subtitle={`${trees.length} registro(s) individualizados.`} className="full-panel">
        {trees.length === 0 ? (
          <EmptyState icon={TreePalm} title="Nenhum coqueiro registrado" detail="Adicione identificadores para começar a acompanhar cada planta." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Identificador</th><th>Variedade</th><th>Plantio</th><th>Linha / posição</th><th>GPS</th></tr></thead>
              <tbody>
                {trees.map((tree) => (
                  <tr key={tree.id}>
                    <td><span className="tree-id"><TreePalm size={14} /> {tree.identifier}</span></td>
                    <td>{tree.variety || "—"}</td>
                    <td>{formatDate(tree.planted_at)}</td>
                    <td>{tree.row_number && tree.position_number ? `${tree.row_number} / ${tree.position_number}` : "—"}</td>
                    <td>{tree.latitude !== null && tree.longitude !== null ? `${formatNumber(tree.latitude, 5)}, ${formatNumber(tree.longitude, 5)}` : "Não informado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function CalendarSection({
  tasks,
  trees,
  busy,
  onSubmit,
  onTaskUpdate,
}: {
  tasks: Task[];
  trees: Tree[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTaskUpdate: (task: Task) => void;
}) {
  const openCount = tasks.filter((task) => task.status !== "done").length;
  const overdueCount = tasks.filter((task) => task.status !== "done" && task.due_date < todayInput()).length;
  return (
    <div className="content-grid">
      <Panel title="Adicionar atividade" subtitle="Registre ações planejadas pelo produtor ou profissional responsável.">
        <form className="form-grid" onSubmit={onSubmit}>
          <Field label="Atividade" name="title" required placeholder="Ex.: vistoria do talhão" />
          <Field label="Data" name="due_date" type="date" required defaultValue={shortDateInput(1)} />
          <SelectField label="Prioridade" name="priority" defaultValue="normal">
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </SelectField>
          <SelectField label="Coqueiro específico (opcional)" name="tree_id">
            <option value="">Talhão / propriedade</option>
            {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.identifier}</option>)}
          </SelectField>
          <label className="field full-width">
            <span>Instruções / observações</span>
            <textarea name="description" rows={3} maxLength={1000} placeholder="Descreva o que precisa ser feito e os cuidados pertinentes." />
          </label>
          <div className="form-submit full-width"><SubmitButton busy={busy}>Adicionar ao calendário</SubmitButton></div>
        </form>
      </Panel>
      <Panel title="Resumo do calendário" subtitle="As tarefas são registros operacionais, não recomendações automáticas.">
        <div className="calendar-summary">
          <div><span>Em aberto</span><strong>{openCount}</strong><CalendarDays size={18} /></div>
          <div className={overdueCount ? "summary-warn" : ""}><span>Atrasadas</span><strong>{overdueCount}</strong><CircleAlert size={18} /></div>
        </div>
        <p className="panel-footnote">Prioridade e data devem ser definidas conforme o plano da propriedade. Confirme insumos, condições e segurança antes da execução.</p>
      </Panel>
      <Panel title="Atividades registradas" subtitle="Marque como concluída após confirmar a execução." className="full-panel">
        {tasks.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Calendário vazio" detail="Adicione a primeira atividade planejada para esta propriedade." />
        ) : (
          <div className="task-list">
            {tasks.map((task) => <TaskRow key={task.id} task={task} onUpdate={onTaskUpdate} />)}
          </div>
        )}
      </Panel>
    </div>
  );
}

function NutritionSection({
  workspace,
  references,
  busy,
  result,
  onSoilSubmit,
  onApplicationSubmit,
  onCalculate,
}: {
  workspace: Workspace | null;
  references: AgronomicReferences | null;
  busy: boolean;
  result: FertilizerCalculation | null;
  onSoilSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onApplicationSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCalculate: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const analyses = workspace?.soil_analyses ?? [];
  const applications = workspace?.fertilization_applications ?? [];
  const trees = workspace?.trees ?? [];
  return (
    <div className="nutrition-layout">
      <Panel title="Registrar análise de solo" subtitle="Entrada manual revisável. A importação de PDF/OCR não está habilitada neste MVP.">
        <form className="form-grid" onSubmit={onSoilSubmit}>
          <Field label="Talhão" name="plot_name" required placeholder="Ex.: Talhão A" />
          <Field label="Data da coleta" name="sample_date" type="date" required defaultValue={todayInput()} />
          <Field label="Profundidade" name="depth_cm" required placeholder="Ex.: 0-20 cm" />
          <Field label="pH" name="ph" type="number" min={0} max={14} step="0.01" />
          <Field label="Matéria orgânica (%)" name="organic_matter_pct" type="number" min={0} max={100} step="0.01" />
          <Field label="Fósforo (mg/dm³)" name="phosphorus_mg_dm3" type="number" min={0} step="any" />
          <Field label="Potássio (mg/dm³)" name="potassium_mg_dm3" type="number" min={0} step="any" />
          <Field label="Cálcio (cmolc/dm³)" name="calcium_cmolc_dm3" type="number" min={0} step="any" />
          <Field label="Magnésio (cmolc/dm³)" name="magnesium_cmolc_dm3" type="number" min={0} step="any" />
          <Field label="Alumínio (cmolc/dm³)" name="aluminum_cmolc_dm3" type="number" min={0} step="any" />
          <Field label="CTC (cmolc/dm³)" name="ctc_cmolc_dm3" type="number" min={0} step="any" />
          <Field label="Saturação por bases (%)" name="base_saturation_pct" type="number" min={0} max={100} step="any" />
          <Field label="Laboratório" name="laboratory" placeholder="Opcional" />
          <Field label="Método de análise" name="lab_method" placeholder="Conforme laudo" />
          <label className="checkbox-field full-width">
            <input name="reviewed" type="checkbox" />
            <span>Conferi a transcrição com o laudo original</span>
          </label>
          <div className="form-submit full-width"><SubmitButton busy={busy}>Salvar análise</SubmitButton></div>
        </form>
      </Panel>

      <Panel title="Análises registradas" subtitle="Unidades identificadas no formulário. Valores não geram recomendação automática.">
        {analyses.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhuma análise registrada" detail="Registre os valores conferidos do laudo laboratorial." />
        ) : (
          <div className="analysis-list">
            {analyses.map((analysis) => <SoilAnalysisCard key={analysis.id} analysis={analysis} />)}
          </div>
        )}
      </Panel>

      <Panel title="Calculadora de fertilizante" subtitle="Converte alvos já definidos em produto comercial e mostra contribuições simultâneas." className="full-panel">
        <div className="callout callout-amber">
          <CircleAlert size={18} />
          <div><strong>Não é prescrição</strong><span>Informe metas de um plano validado e a composição do rótulo. O resultado é matemático, não autoriza aplicação nem escolhe doses.</span></div>
        </div>
        <form className="form-grid calculator-form" onSubmit={onCalculate}>
          <div className="form-subhead full-width"><span>Alvos validados por planta</span></div>
          <Field label="N (g/planta)" name="target_n_g_per_tree" type="number" min={0} step="any" required />
          <Field label="P₂O₅ (g/planta)" name="target_p2o5_g_per_tree" type="number" min={0} step="any" required />
          <Field label="K₂O (g/planta)" name="target_k2o_g_per_tree" type="number" min={0} step="any" required />
          <div className="form-subhead full-width"><span>Composição declarada no rótulo</span></div>
          <Field label="N (%)" name="composition_n_pct" type="number" min={0} max={100} step="any" required />
          <Field label="P₂O₅ (%)" name="composition_p2o5_pct" type="number" min={0} max={100} step="any" required />
          <Field label="K₂O (%)" name="composition_k2o_pct" type="number" min={0} max={100} step="any" required />
          <div className="form-subhead full-width"><span>Escala e custo</span></div>
          <Field label="Coqueiros a atender" name="tree_count" type="number" min={1} step={1} required defaultValue={trees.length || workspace?.farm.planted_tree_count || undefined} />
          <Field label="Embalagem (kg)" name="package_kg" type="number" min={0.001} step="any" />
          <Field label="Preço por embalagem (R$)" name="price_per_package" type="number" min={0} step="any" />
          <div className="form-submit full-width"><button className="button button-primary" type="submit"><Gauge size={16} /> Calcular quantidade e excedentes</button></div>
        </form>
        {result && <FertilizerResultCard result={result} />}
      </Panel>

      <Panel title="Registrar aplicação realizada" subtitle="Registro de histórico. A API bloqueia duplicidade por data, produto e local.">
        <form className="form-grid" onSubmit={onApplicationSubmit}>
          <Field label="Produto comercial" name="product_name" required placeholder="Nome conforme rótulo" />
          <Field label="Quantidade aplicada (kg)" name="quantity_kg" type="number" min={0.001} step="any" required />
          <Field label="Data" name="applied_on" type="date" required defaultValue={todayInput()} />
          <SelectField label="Escopo" name="scope" defaultValue="farm">
            <option value="farm">Propriedade</option>
            <option value="plot">Talhão</option>
            <option value="tree">Coqueiro individual</option>
          </SelectField>
          <Field label="Talhão (se aplicável)" name="plot_name" placeholder="Nome do talhão" />
          <SelectField label="Coqueiro (se individual)" name="tree_id">
            <option value="">Selecione se necessário</option>
            {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.identifier}</option>)}
          </SelectField>
          <Field label="Referência do plano (opcional)" name="plan_reference" placeholder="Laudo / plano profissional" />
          <div className="form-submit full-width"><SubmitButton busy={busy}>Registrar aplicação</SubmitButton></div>
        </form>
        {applications.length > 0 && (
          <div className="application-history">
            <h3>Histórico de aplicações</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Produto</th><th>Quantidade</th><th>Local</th><th>Plano</th></tr></thead>
                <tbody>
                  {applications.slice(0, 10).map((item) => <ApplicationRow key={item.id} item={item} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Referências históricas" subtitle={references?.fertilization.source ?? "Referência informada no escopo do projeto."} className="full-panel reference-panel">
        <div className="callout callout-neutral">
          <CircleHelp size={17} />
          <div><strong>Publicação de 2000 · referência histórica</strong><span>{references?.fertilization.note ?? "Não utilizar como prescrição universal. Confirme a versão original, região, análise e orientação técnica atual."}</span></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Idade</th><th>N (g/planta/ano)</th><th>P₂O₅ (g/planta/ano)</th><th>K₂O (g/planta/ano)</th></tr></thead>
            <tbody>
              {(references?.fertilization.annual_ranges_g_per_tree ?? []).map((row) => (
                <tr key={row.age}>
                  <td>{row.age}</td><td>{formatNumber(row.n, 0)}</td>
                  <td>{row.p2o5_min === null ? "—" : `${row.p2o5_min}–${row.p2o5_max}`}</td>
                  <td>{row.k2o_min === null ? "—" : `${row.k2o_min}–${row.k2o_max}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-footnote">As faixas de fósforo e potássio dependem da análise de solo e das classes originais de fertilidade. O sistema não seleciona um valor dentro das faixas.</p>
      </Panel>
    </div>
  );
}

function SoilAnalysisCard({ analysis }: { analysis: SoilAnalysis }) {
  return (
    <article className="analysis-card">
      <div className="analysis-card-heading">
        <div><strong>{analysis.plot_name}</strong><span>{formatDate(analysis.sample_date)} · {analysis.depth_cm}</span></div>
        <span className={`review-chip ${analysis.reviewed ? "reviewed" : ""}`}>{analysis.reviewed ? "Conferido" : "Pendente de conferência"}</span>
      </div>
      <div className="analysis-values">
        <span>pH <b>{formatNumber(analysis.ph, 2)}</b></span>
        <span>P <b>{formatNumber(analysis.phosphorus_mg_dm3)}</b></span>
        <span>K <b>{formatNumber(analysis.potassium_mg_dm3)}</b></span>
        <span>CTC <b>{formatNumber(analysis.ctc_cmolc_dm3)}</b></span>
      </div>
      {(analysis.laboratory || analysis.lab_method) && (
        <small>{[analysis.laboratory, analysis.lab_method].filter(Boolean).join(" · ")}</small>
      )}
    </article>
  );
}

function FertilizerResultCard({ result }: { result: FertilizerCalculation }) {
  return (
    <div className="calculation-result">
      <div className="result-heading"><CheckCircle2 size={18} /><div><strong>Resultado do cálculo</strong><span>Estimativa aritmética para a composição informada.</span></div></div>
      <div className="result-grid">
        <div><span>Produto por coqueiro</span><strong>{formatNumber(result.product_grams_per_tree, 2)} g</strong></div>
        <div><span>Total de produto</span><strong>{formatNumber(result.total_product_kg, 2)} kg</strong></div>
        <div><span>Embalagens inteiras</span><strong>{result.package_count ?? "—"}</strong></div>
        <div><span>Custo estimado</span><strong>{formatCurrency(result.estimated_purchase_cost)}</strong></div>
      </div>
      <div className="nutrient-balance">
        <span>N fornecido: <b>{formatNumber(result.supplied_n_g_per_tree, 2)} g</b> {result.excess_n_g_per_tree > 0 && <em>· excesso {formatNumber(result.excess_n_g_per_tree, 2)} g</em>}</span>
        <span>P₂O₅ fornecido: <b>{formatNumber(result.supplied_p2o5_g_per_tree, 2)} g</b> {result.excess_p2o5_g_per_tree > 0 && <em>· excesso {formatNumber(result.excess_p2o5_g_per_tree, 2)} g</em>}</span>
        <span>K₂O fornecido: <b>{formatNumber(result.supplied_k2o_g_per_tree, 2)} g</b> {result.excess_k2o_g_per_tree > 0 && <em>· excesso {formatNumber(result.excess_k2o_g_per_tree, 2)} g</em>}</span>
      </div>
      <p className="result-note"><CircleAlert size={14} /> {result.note}</p>
    </div>
  );
}

function ApplicationRow({ item }: { item: FertilizationApplication }) {
  const location =
    item.scope === "tree"
      ? `Coqueiro #${item.tree_id}`
      : item.scope === "plot"
        ? item.plot_name || "Talhão"
        : "Propriedade";
  return (
    <tr>
      <td>{formatDate(item.applied_on)}</td><td>{item.product_name}</td>
      <td>{formatNumber(item.quantity_kg, 2)} kg</td><td>{location}</td>
      <td>{item.plan_reference || "—"}</td>
    </tr>
  );
}

function IrrigationSection({
  workspace,
  busy,
  result,
  onCalculate,
  onEventSubmit,
}: {
  workspace: Workspace | null;
  busy: boolean;
  result: IrrigationCalculation | null;
  onCalculate: (event: FormEvent<HTMLFormElement>) => void;
  onEventSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const events = workspace?.irrigation_events ?? [];
  const treeCount = workspace?.trees.length || workspace?.farm.planted_tree_count || undefined;
  return (
    <div className="content-grid">
      <Panel title="Estimativa de necessidade hídrica" subtitle="ETc = ETo × Kc; volume bruto ajustado pela eficiência informada.">
        <div className="callout callout-amber">
          <CircleAlert size={18} />
          <div><strong>Estimativa assistida, não comando</strong><span>Informe ETo, Kc, chuva efetiva, área, plantas e eficiência medidos/validados. O sistema não liga equipamentos.</span></div>
        </div>
        <form className="form-grid calculator-form" onSubmit={onCalculate}>
          <Field label="ETo (mm/dia)" name="eto_mm_day" type="number" min={0} step="any" required />
          <Field label="Kc validado para a fase" name="kc" type="number" min={0.001} step="any" required />
          <Field label="Chuva efetiva (mm/dia)" name="effective_rain_mm_day" type="number" min={0} step="any" required />
          <Field label="Eficiência do sistema (%)" name="efficiency_percent" type="number" min={0.001} max={100} step="any" required />
          <Field label="Área atendida (ha)" name="area_ha" type="number" min={0.001} step="any" required defaultValue={workspace?.farm.cultivated_area_ha || undefined} />
          <Field label="Coqueiros atendidos" name="tree_count" type="number" min={1} step={1} required defaultValue={treeCount} />
          <Field label="Emissores por coqueiro (opcional)" name="emitters_per_tree" type="number" min={1} step={1} />
          <Field label="Vazão por emissor (L/h, opcional)" name="flow_liters_per_hour" type="number" min={0.001} step="any" />
          <div className="form-submit full-width"><button className="button button-primary" type="submit"><Droplets size={16} /> Calcular estimativa</button></div>
        </form>
        {result && <IrrigationResultCard result={result} />}
      </Panel>

      <Panel title="Registrar irrigação realizada" subtitle="Entrada manual de um evento ocorrido.">
        <form className="form-grid" onSubmit={onEventSubmit}>
          <Field label="Data" name="recorded_on" type="date" required defaultValue={todayInput()} />
          <Field label="Volume aplicado (L)" name="volume_liters" type="number" min={0.001} step="any" required />
          <Field label="Duração (min)" name="runtime_minutes" type="number" min={0.001} step="any" />
          <Field label="Área (ha)" name="area_ha" type="number" min={0.001} step="any" />
          <Field label="Talhão" name="plot_name" placeholder="Opcional" />
          <label className="field full-width">
            <span>Observações</span>
            <textarea name="notes" rows={3} maxLength={500} placeholder="Origem da medição, equipamento, observações..." />
          </label>
          <div className="form-submit full-width"><SubmitButton busy={busy}>Salvar registro</SubmitButton></div>
        </form>
      </Panel>

      <Panel title="Histórico de irrigação" subtitle="Registros inseridos pela propriedade." className="full-panel">
        {events.length === 0 ? (
          <EmptyState icon={Droplets} title="Nenhum evento registrado" detail="Sem medições, não há consumo real para exibir." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Talhão</th><th>Volume</th><th>Duração</th><th>Área</th><th>Observações</th></tr></thead>
              <tbody>
                {events.map((event) => <IrrigationRow key={event.id} event={event} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function IrrigationResultCard({ result }: { result: IrrigationCalculation }) {
  return (
    <div className="calculation-result">
      <div className="result-heading"><Droplets size={18} /><div><strong>Estimativa calculada</strong><span>Não aciona bombas, válvulas ou controladores.</span></div></div>
      <div className="result-grid">
        <div><span>ETc</span><strong>{formatNumber(result.etc_mm_day, 2)} mm/dia</strong></div>
        <div><span>Lâmina bruta</span><strong>{formatNumber(result.gross_irrigation_depth_mm_day, 2)} mm/dia</strong></div>
        <div><span>Volume total</span><strong>{formatNumber(result.total_volume_liters_day, 0)} L/dia</strong></div>
        <div><span>Por coqueiro</span><strong>{formatNumber(result.liters_per_tree_day, 1)} L/dia</strong></div>
        <div><span>Tempo estimado</span><strong>{result.runtime_hours_estimate === null ? "Informe vazão/emissores" : `${formatNumber(result.runtime_hours_estimate, 2)} h`}</strong></div>
      </div>
      <p className="result-note"><CircleAlert size={14} /> {result.note}</p>
    </div>
  );
}

function IrrigationRow({ event }: { event: IrrigationEvent }) {
  return (
    <tr>
      <td>{formatDate(event.recorded_on)}</td><td>{event.plot_name || "—"}</td>
      <td>{formatNumber(event.volume_liters, 0)} L</td>
      <td>{event.runtime_minutes === null ? "—" : `${formatNumber(event.runtime_minutes)} min`}</td>
      <td>{event.area_ha === null ? "—" : `${formatNumber(event.area_ha)} ha`}</td>
      <td>{event.notes || "—"}</td>
    </tr>
  );
}

function InventorySection({
  items,
  busy,
  onSubmit,
}: {
  items: InventoryItem[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="content-grid">
      <Panel title="Adicionar item ao estoque" subtitle="Registre a composição conforme embalagem ou ficha técnica.">
        <form className="form-grid" onSubmit={onSubmit}>
          <Field label="Nome do insumo" name="name" required placeholder="Produto / material" />
          <SelectField label="Categoria" name="category" required>
            <option value="">Selecione</option>
            <option value="fertilizante">Fertilizante</option>
            <option value="corretivo">Corretivo</option>
            <option value="defensivo">Defensivo</option>
            <option value="irrigacao">Irrigação</option>
            <option value="outro">Outro</option>
          </SelectField>
          <Field label="Quantidade" name="quantity" type="number" min={0} step="any" required />
          <Field label="Unidade" name="unit" required placeholder="kg, L, unidade..." />
          <Field label="Custo por unidade (R$)" name="unit_cost" type="number" min={0} step="any" />
          <Field label="Lote" name="lot" placeholder="Opcional" />
          <Field label="Validade" name="expires_on" type="date" />
          <div className="form-subhead full-width"><span>Composição NPK declarada (%) · opcional</span></div>
          <Field label="N (%)" name="n_pct" type="number" min={0} max={100} step="any" />
          <Field label="P₂O₅ (%)" name="p2o5_pct" type="number" min={0} max={100} step="any" />
          <Field label="K₂O (%)" name="k2o_pct" type="number" min={0} max={100} step="any" />
          <div className="form-submit full-width"><SubmitButton busy={busy}>Adicionar ao estoque</SubmitButton></div>
        </form>
      </Panel>
      <Panel title="Resumo do estoque" subtitle="Sem limites de reposição configurados.">
        <div className="inventory-summary">
          <div className="inventory-total"><Package size={20} /><strong>{items.length}</strong><span>itens registrados</span></div>
          <div className="inventory-hint"><CircleHelp size={15} /><span>O MVP não estima consumo futuro sem plano de manejo e histórico suficientes.</span></div>
        </div>
      </Panel>
      <Panel title="Itens cadastrados" subtitle={`${items.length} item(ns) na propriedade.`} className="full-panel">
        {items.length === 0 ? (
          <EmptyState icon={Package} title="Estoque vazio" detail="Adicione insumos para acompanhar quantidades, lotes, custos e validade." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produto</th><th>Categoria</th><th>Quantidade</th><th>Lote</th><th>Validade</th><th>N–P₂O₅–K₂O</th><th>Custo unitário</th></tr></thead>
              <tbody>
                {items.map((item) => <InventoryRow key={item.id} item={item} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function InventoryRow({ item }: { item: InventoryItem }) {
  const expiring = item.expires_on ? item.expires_on <= shortDateInput(30) : false;
  const composition =
    item.n_pct === null && item.p2o5_pct === null && item.k2o_pct === null
      ? "—"
      : `${formatNumber(item.n_pct, 1)}–${formatNumber(item.p2o5_pct, 1)}–${formatNumber(item.k2o_pct, 1)}`;
  return (
    <tr>
      <td><span className="product-name"><Package size={14} /> {item.name}</span></td>
      <td><span className="category-chip">{item.category}</span></td>
      <td><strong>{formatNumber(item.quantity, 2)} {item.unit}</strong></td>
      <td>{item.lot || "—"}</td>
      <td className={expiring ? "expiry-soon" : ""}>{item.expires_on ? formatDate(item.expires_on) : "—"}{expiring && <span className="expiry-label">Verificar</span>}</td>
      <td>{composition}</td>
      <td>{item.unit_cost === null ? "—" : formatCurrency(item.unit_cost)}</td>
    </tr>
  );
}

function HarvestSection({
  workspace,
  busy,
  onSubmit,
}: {
  workspace: Workspace | null;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const harvests = workspace?.harvests ?? [];
  const trees = workspace?.trees ?? [];
  const totalFruits = harvests.reduce((sum, item) => sum + item.fruits_harvested, 0);
  const totalDiscarded = harvests.reduce((sum, item) => sum + item.fruits_discarded, 0);
  const revenue = harvests.reduce(
    (sum, item) => sum + (item.price_per_fruit === null ? 0 : item.fruits_harvested * item.price_per_fruit),
    0,
  );
  const hasRevenue = harvests.some((item) => item.price_per_fruit !== null);
  return (
    <div className="content-grid">
      <Panel title="Registrar colheita" subtitle="Registre os volumes observados; preço e receita são informados pelo produtor.">
        <form className="form-grid" onSubmit={onSubmit}>
          <Field label="Data da colheita" name="harvested_on" type="date" required defaultValue={todayInput()} />
          <Field label="Frutos colhidos" name="fruits_harvested" type="number" min={0} step={1} required />
          <Field label="Frutos descartados" name="fruits_discarded" type="number" min={0} step={1} defaultValue={0} />
          <Field label="Peso total (kg)" name="weight_kg" type="number" min={0} step="any" />
          <Field label="Preço por fruto (R$)" name="price_per_fruit" type="number" min={0} step="any" />
          <Field label="Destinação / lote" name="destination" placeholder="Opcional" />
          <SelectField label="Coqueiro (opcional)" name="tree_id">
            <option value="">Propriedade / talhão</option>
            {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.identifier}</option>)}
          </SelectField>
          <div className="form-submit full-width"><SubmitButton busy={busy}>Salvar colheita</SubmitButton></div>
        </form>
      </Panel>
      <Panel title="Resumo da produção" subtitle="Soma dos registros armazenados.">
        <div className="harvest-kpis">
          <div><span>Frutos colhidos</span><strong>{formatNumber(totalFruits, 0)}</strong></div>
          <div><span>Frutos descartados</span><strong>{formatNumber(totalDiscarded, 0)}</strong></div>
          <div><span>Receita informada</span><strong>{hasRevenue ? formatCurrency(revenue) : "—"}</strong></div>
        </div>
        <p className="panel-footnote">Os resultados não atribuem causalidade a práticas de manejo nem incluem custos não registrados.</p>
      </Panel>
      <Panel title="Histórico de colheita" subtitle="A comparação depende de registros completos e consistentes." className="full-panel">
        {harvests.length === 0 ? (
          <EmptyState icon={Sprout} title="Nenhuma colheita registrada" detail="Adicione uma colheita para iniciar o histórico de produção." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Frutos</th><th>Descartados</th><th>Peso</th><th>Preço/fruto</th><th>Receita estimada</th><th>Destinação</th></tr></thead>
              <tbody>
                {harvests.map((harvest) => <HarvestRow key={harvest.id} harvest={harvest} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function HarvestRow({ harvest }: { harvest: Harvest }) {
  const revenue =
    harvest.price_per_fruit === null
      ? null
      : harvest.fruits_harvested * harvest.price_per_fruit;
  return (
    <tr>
      <td>{formatDate(harvest.harvested_on)}</td>
      <td>{formatNumber(harvest.fruits_harvested, 0)}</td>
      <td>{formatNumber(harvest.fruits_discarded, 0)}</td>
      <td>{harvest.weight_kg === null ? "—" : `${formatNumber(harvest.weight_kg, 2)} kg`}</td>
      <td>{harvest.price_per_fruit === null ? "—" : formatCurrency(harvest.price_per_fruit)}</td>
      <td>{formatCurrency(revenue)}</td>
      <td>{harvest.destination || "—"}</td>
    </tr>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>;
}
