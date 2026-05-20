"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useConnectionStore, type DBType, type LLMProfile, type DBProfile } from "@/stores/connection";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { testConnection } from "@/lib/api";
import { toast } from "sonner";
import {
  Sparkles, Brain, Zap, Puzzle,
  Database, HardDrive, DatabaseZap,
  Settings, MessageSquare, Server,
  Eye, EyeOff, Plus, Trash2, Check, Info, X, RotateCcw,
  Loader2, ChevronRight,
} from "lucide-react";

const fieldCls =
  "w-full px-3 py-2.5 rounded-lg border border-[--border] bg-white text-[14px] text-[--foreground] placeholder:text-[--muted-foreground]/40 focus:outline-none focus:border-[--ring] focus:ring-2 focus:ring-[--ring]/10 transition-all duration-150";

const labelCls = "text-[11px] font-semibold text-[--muted-foreground] uppercase tracking-[0.05em]";

// ─── LLM Provider Registry ───

type LLMProvider = LLMProfile["config"]["provider"];
type LLMProfilePatch = Partial<Omit<LLMProfile, "id" | "createdAt">>;
type DBProfilePatch = Partial<Omit<DBProfile, "id" | "createdAt">>;
type ServerDBConfig = Extract<DBProfile["config"], { type: "postgresql" | "mysql" }>;
type FileDBConfig = Extract<DBProfile["config"], { type: "sqlite" | "duckdb" }>;

interface ProviderEntry {
  label: string;
  color: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>;
  baseUrl: string;
  models: string[];
}

const PROVIDER_REGISTRY: Record<LLMProvider, ProviderEntry> = {
  deepseek: {
    label: "DeepSeek",
    color: "#4D6BFE",
    icon: Sparkles,
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
  },
  mimo: {
    label: "MiMo",
    color: "#FF6900",
    icon: Zap,
    baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    models: ["mimo-v2.5", "mimo-v2.5-pro"],
  },
  custom: {
    label: "自定义",
    color: "#8b5cf6",
    icon: Puzzle,
    baseUrl: "",
    models: [],
  },
};

const PROVIDER_KEYS = Object.keys(PROVIDER_REGISTRY) as LLMProvider[];

function getProviderEntry(provider: LLMProvider): ProviderEntry {
  return PROVIDER_REGISTRY[provider] || PROVIDER_REGISTRY.custom;
}

// ─── DB Type Registry ───

interface DBTypeEntry {
  label: string;
  color: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>;
}

const DB_TYPE_REGISTRY: Record<DBType, DBTypeEntry> = {
  postgresql: { label: "PostgreSQL", color: "#336791", icon: Database },
  mysql: { label: "MySQL", color: "#4479A1", icon: Database },
  sqlite: { label: "SQLite", color: "#003B57", icon: HardDrive },
  duckdb: { label: "DuckDB", color: "#FFC107", icon: DatabaseZap },
};

const DB_TYPES = Object.entries(DB_TYPE_REGISTRY) as [DBType, DBTypeEntry][];

function isServerDBConfig(config: DBProfile["config"]): config is ServerDBConfig {
  return config.type === "postgresql" || config.type === "mysql";
}

function defaultDBConfig(type: DBType): DBProfile["config"] {
  if (type === "sqlite" || type === "duckdb") {
    return { type, filePath: "" } satisfies FileDBConfig;
  }
  return {
    type,
    host: "localhost",
    port: type === "mysql" ? "3306" : "5432",
    user: "",
    password: "",
    database: "",
  } satisfies ServerDBConfig;
}

// ─── Helpers ───

function generateProfileName(prefix: string, existing: { name: string }[]): string {
  // Find the highest number used in names like "Prefix 1", "Prefix 2", etc.
  let maxNum = 0;
  for (const p of existing) {
    if (!p.name.startsWith(prefix)) continue;
    const suffix = p.name.slice(prefix.length).trim();
    const num = parseInt(suffix, 10);
    if (!isNaN(num)) maxNum = Math.max(maxNum, num);
  }
  return `${prefix} ${maxNum + 1}`;
}

// ─── Card selection animation hook ───

function useCardAnimation() {
  const refs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const setRef = useCallback((key: string) => (el: HTMLButtonElement | null) => {
    if (el) refs.current.set(key, el);
    else refs.current.delete(key);
  }, []);

  const animate = useCallback((key: string) => {
    const el = refs.current.get(key);
    if (!el) return;
    el.classList.remove("card-selected");
    void el.offsetWidth; // force reflow
    el.classList.add("card-selected");
  }, []);

  return { setRef, animate };
}

// ─── Chip row component ───

function ChipRow<T extends { id: string; name: string }>({
  items,
  editingId,
  activeId,
  onSelect,
}: {
  items: T[];
  editingId: string | null;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {items.map((item) => {
        const editing = item.id === editingId;
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
              editing
                ? "bg-[--muted] text-[--foreground] shadow-sm"
                : "text-[--muted-foreground] hover:bg-[--muted]/60 hover:text-[--foreground]"
            }`}
          >
            {active && (
              <span className="w-1.5 h-1.5 rounded-full bg-[--success] shrink-0 animate-[pulse_2s_ease-in-out_1]" />
            )}
            {item.name}
            {editing && (
              <span
                className="absolute bottom-0 left-2 right-2 h-0.5 bg-[--primary] rounded-full origin-left"
                style={{ animation: "chip-indicator 0.2s ease-out forwards" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Provider Card Component ───

function ProviderCard({
  providerKey,
  entry,
  selected,
  onClick,
  animRef,
}: {
  providerKey: LLMProvider;
  entry: ProviderEntry;
  selected: boolean;
  onClick: () => void;
  animRef: (el: HTMLButtonElement | null) => void;
}) {
  const Icon = entry.icon;
  return (
    <button
      ref={animRef}
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      className={`group relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all duration-150 cursor-pointer overflow-hidden ${
        selected
          ? "border-[--primary] bg-[--primary]/[0.04] shadow-sm"
          : "border-transparent bg-[--muted]/60 hover:bg-[--muted] hover:-translate-y-0.5 hover:shadow-[var(--shadow-depth-1)]"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
          selected ? "scale-105" : "group-hover:scale-105"
        }`}
        style={{ background: selected ? entry.color : `${entry.color}20` }}
      >
        <Icon
          size={18}
          className={`transition-colors duration-150 ${selected ? "text-white" : "opacity-70 group-hover:opacity-100"}`}
          style={{ color: selected ? "#fff" : entry.color }}
        />
      </div>
      <span className={`text-[11px] font-medium leading-tight ${selected ? "text-[--foreground]" : "text-[--muted-foreground]"}`}>
        {entry.label}
      </span>
      {selected && (
        <span
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            animation: "ripple-ring 0.4s ease-out forwards",
            color: `${entry.color}30`,
          }}
        />
      )}
    </button>
  );
}

// ─── DB Type Card Component ───

function DBTypeCard({
  typeKey,
  entry,
  selected,
  onClick,
  animRef,
}: {
  typeKey: DBType;
  entry: DBTypeEntry;
  selected: boolean;
  onClick: () => void;
  animRef: (el: HTMLButtonElement | null) => void;
}) {
  const Icon = entry.icon;
  return (
    <button
      ref={animRef}
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      className={`group relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all duration-150 cursor-pointer overflow-hidden ${
        selected
          ? "border-[--primary] bg-[--primary]/[0.04] shadow-sm"
          : "border-transparent bg-[--muted]/60 hover:bg-[--muted] hover:-translate-y-0.5 hover:shadow-[var(--shadow-depth-1)]"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
          selected ? "scale-105" : "group-hover:scale-105"
        }`}
        style={{ background: selected ? entry.color : `${entry.color}20` }}
      >
        <Icon
          size={18}
          className={`transition-colors duration-150 ${selected ? "text-white" : "opacity-70 group-hover:opacity-100"}`}
          style={{ color: selected ? "#fff" : entry.color }}
        />
      </div>
      <span className={`text-[12px] font-medium ${selected ? "text-[--foreground]" : "text-[--muted-foreground]"}`}>
        {entry.label}
      </span>
      {selected && (
        <span
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            animation: "ripple-ring 0.4s ease-out forwards",
            color: `${entry.color}30`,
          }}
        />
      )}
    </button>
  );
}

// ─── Main Settings Panel ───

export default function SettingsPanel({ onClose }: { onClose?: () => void }) {
  const llmProfiles = useConnectionStore((s) => s.llmProfiles);
  const dbProfiles = useConnectionStore((s) => s.dbProfiles);
  const activeLLMId = useConnectionStore((s) => s.activeLLMId);
  const activeDBId = useConnectionStore((s) => s.activeDBId);
  const editingLLMId = useConnectionStore((s) => s.editingLLMId);
  const editingDBId = useConnectionStore((s) => s.editingDBId);

  const createLLM = useConnectionStore((s) => s.createLLM);
  const updateLLM = useConnectionStore((s) => s.updateLLM);
  const deleteLLM = useConnectionStore((s) => s.deleteLLM);
  const setActiveLLM = useConnectionStore((s) => s.setActiveLLM);
  const setEditingLLM = useConnectionStore((s) => s.setEditingLLM);

  const createDB = useConnectionStore((s) => s.createDB);
  const updateDB = useConnectionStore((s) => s.updateDB);
  const deleteDB = useConnectionStore((s) => s.deleteDB);
  const setActiveDB = useConnectionStore((s) => s.setActiveDB);
  const setEditingDB = useConnectionStore((s) => s.setEditingDB);

  const llmProfile = llmProfiles.find((p) => p.id === editingLLMId) || llmProfiles[0];
  const dbProfile = dbProfiles.find((p) => p.id === editingDBId) || dbProfiles[0];

  // ─── Draft state: edits go here, only committed to store on Save ───
  const [llmDraft, setLlmDraft] = useState<LLMProfile | null>(null);
  const [dbDraft, setDbDraft] = useState<DBProfile | null>(null);
  const llmSavedRef = useRef<string>("");
  const dbSavedRef = useRef<string>("");

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "llm" | "db">("general");

  // Current editing profile (draft if available, otherwise from store)
  const currentLLM = llmDraft && llmDraft.id === editingLLMId ? llmDraft : llmProfile;
  const currentDB = dbDraft && dbDraft.id === editingDBId ? dbDraft : dbProfile;

  // Dirty detection: compare current draft JSON to last-saved snapshot
  const llmJson = currentLLM ? JSON.stringify({ name: currentLLM.name, config: currentLLM.config }) : "";
  const dbJson = currentDB ? JSON.stringify({ name: currentDB.name, config: currentDB.config }) : "";
  const llmDirty = llmJson !== llmSavedRef.current;
  const dbDirty = dbJson !== dbSavedRef.current;
  const isDirty = llmDirty || dbDirty;

  // Sync draft when editing profile changes
  useEffect(() => {
    if (llmProfile) {
      const snap = JSON.stringify({ name: llmProfile.name, config: llmProfile.config });
      if (llmSavedRef.current === "") {
        // First load: take snapshot from store
        llmSavedRef.current = snap;
      }
      // Only reset draft if switching to a different profile
      if (!llmDraft || llmDraft.id !== llmProfile.id) {
        setLlmDraft(llmProfile);
        llmSavedRef.current = snap;
      }
    }
  }, [llmProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dbProfile) {
      const snap = JSON.stringify({ name: dbProfile.name, config: dbProfile.config });
      if (dbSavedRef.current === "") {
        dbSavedRef.current = snap;
      }
      if (!dbDraft || dbDraft.id !== dbProfile.id) {
        setDbDraft(dbProfile);
        dbSavedRef.current = snap;
      }
    }
  }, [dbProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draft update helpers (update local only, NOT store)
  const updateLlmDraft = useCallback((patch: LLMProfilePatch) => {
    setLlmDraft((prev) => prev ? { ...prev, ...patch, config: { ...prev.config, ...patch.config } } : prev);
  }, []);

  const updateDbDraft = useCallback((patch: DBProfilePatch) => {
    setDbDraft((prev) => prev ? { ...prev, ...patch, config: { ...prev.config, ...patch.config } } : prev);
  }, []);

  // Save: commit draft to store
  const handleSave = useCallback(() => {
    if (currentLLM && llmDirty) {
      updateLLM(currentLLM.id, { name: currentLLM.name, config: currentLLM.config });
      llmSavedRef.current = JSON.stringify({ name: currentLLM.name, config: currentLLM.config });
    }
    if (currentDB && dbDirty) {
      updateDB(currentDB.id, { name: currentDB.name, config: currentDB.config });
      dbSavedRef.current = JSON.stringify({ name: currentDB.name, config: currentDB.config });
    }
    toast.success("配置已保存");
  }, [currentLLM, currentDB, llmDirty, dbDirty, updateLLM, updateDB]);

  // Cancel: revert draft to store state
  const handleCancel = useCallback(() => {
    if (llmProfile) {
      setLlmDraft(llmProfile);
      llmSavedRef.current = JSON.stringify({ name: llmProfile.name, config: llmProfile.config });
    }
    if (dbProfile) {
      setDbDraft(dbProfile);
      dbSavedRef.current = JSON.stringify({ name: dbProfile.name, config: dbProfile.config });
    }
    toast.info("已放弃更改");
  }, [llmProfile, dbProfile]);

  // Save on profile switch (prevent losing work)
  const handleSelectLLM = useCallback((id: string) => {
    if (currentLLM && llmDirty) {
      updateLLM(currentLLM.id, { name: currentLLM.name, config: currentLLM.config });
    }
    setEditingLLM(id);
  }, [currentLLM, llmDirty, updateLLM, setEditingLLM]);

  const handleSelectDB = useCallback((id: string) => {
    if (currentDB && dbDirty) {
      updateDB(currentDB.id, { name: currentDB.name, config: currentDB.config });
    }
    setEditingDB(id);
  }, [currentDB, dbDirty, updateDB, setEditingDB]);

  // Auto-save on close
  const handleClose = useCallback(() => {
    if (currentLLM && llmDirty) {
      updateLLM(currentLLM.id, { name: currentLLM.name, config: currentLLM.config });
    }
    if (currentDB && dbDirty) {
      updateDB(currentDB.id, { name: currentDB.name, config: currentDB.config });
    }
    onClose?.();
  }, [currentLLM, currentDB, llmDirty, dbDirty, updateLLM, updateDB, onClose]);

  if (!currentLLM || !currentDB) return null;

  // Local URL assembly from draft (don't rely on store for this)
  const assembleDraftDbUrl = (p: DBProfile): string => {
    const { config } = p;
    switch (config.type) {
      case "postgresql": return `postgresql+psycopg2://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
      case "mysql": return `mysql+pymysql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
      case "sqlite": return `sqlite:///${config.filePath}`;
      case "duckdb": return `duckdb:///${config.filePath}`;
      default: return "";
    }
  };

  const handleTestConnection = async () => {
    const url = assembleDraftDbUrl(currentDB);
    if (!url) { toast.error("请先填写数据库连接信息"); return; }
    setTesting(true); setTestResult(null);
    try {
      const res = await testConnection(url);
      setTestResult(res.success ? "ok" : "fail");
      if (res.success) toast.success("连接成功");
      else toast.error(res.error || "连接失败");
    } catch { setTestResult("fail"); toast.error("连接测试失败"); }
    finally { setTesting(false); }
  };

  return (
    <div className="flex flex-col min-h-0 sm:min-h-[640px] max-h-[90vh] lg:max-h-[85vh]">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-[--border]">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[--foreground]">设置</h2>
            <p className="text-[12px] text-[--muted-foreground] mt-0.5">管理 LLM 模型和数据库连接</p>
          </div>
          {isDirty && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[11px] font-medium ring-1 ring-amber-200 animate-in fade-in-0 duration-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              未保存
            </span>
          )}
        </div>
        <button
          onClick={handleClose}
          aria-label="关闭"
          className="p-1.5 rounded-lg hover:bg-[--muted] text-[--muted-foreground] hover:text-[--foreground] cursor-pointer transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* ─── Tabs ─── */}
      <div className="px-5 sm:px-8 pt-4 sm:pt-5">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "general" | "llm" | "db")}>
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="general" className="flex-1 text-[13px] py-2 font-medium">
              <Settings size={14} className="mr-1.5 opacity-50" />
              通用
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex-1 text-[13px] py-2 font-medium">
              <MessageSquare size={14} className="mr-1.5 opacity-50" />
              LLM 模型
              {llmDirty && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400" />}
            </TabsTrigger>
            <TabsTrigger value="db" className="flex-1 text-[13px] py-2 font-medium">
              <Server size={14} className="mr-1.5 opacity-50" />
              数据库
              {dbDirty && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400" />}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ─── Tab content ─── */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-4 sm:py-5">
        <div key={activeTab} className="tab-content-enter">
          {activeTab === "general" ? (
            <GeneralPanel />
          ) : activeTab === "llm" ? (
            <LLMPanel
              profiles={llmProfiles}
              profile={currentLLM}
              editingId={editingLLMId}
              activeId={activeLLMId}
              showKey={showKey}
              onToggleKey={() => setShowKey(!showKey)}
              onSelect={handleSelectLLM}
              onCreate={createLLM}
              onDelete={deleteLLM}
              onActivate={setActiveLLM}
              onUpdate={updateLlmDraft}
            />
          ) : (
            <DBPanel
              profiles={dbProfiles}
              profile={currentDB}
              editingId={editingDBId}
              activeId={activeDBId}
              testing={testing}
              testResult={testResult}
              onSelect={handleSelectDB}
              onCreate={createDB}
              onDelete={deleteDB}
              onActivate={setActiveDB}
              onUpdate={updateDbDraft}
              onTest={handleTestConnection}
              onResetTest={() => setTestResult(null)}
            />
          )}
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="px-5 sm:px-8 py-3 border-t border-[--border] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] cursor-pointer transition-colors"
            >
              放弃更改
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
              isDirty
                ? "bg-[--primary] text-[--primary-foreground] hover:opacity-90 active:scale-95"
                : "bg-[--muted] text-[--muted-foreground] cursor-not-allowed"
            }`}
          >
            <Check size={14} />
            {isDirty ? "保存配置" : "已保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── General Panel ───
function GeneralPanel() {
  return (
    <div className="space-y-5">
      <section className="bg-[--muted]/60 rounded-xl p-4 ring-1 ring-[--border]/50">
        <h3 className="text-[13px] font-semibold text-[--foreground] mb-3">快捷键</h3>
        <div className="space-y-2.5">
          {[
            { keys: "Ctrl + K", desc: "搜索对话" },
            { keys: "Esc", desc: "关闭弹窗" },
            { keys: "Enter", desc: "发送消息" },
            { keys: "Shift + Enter", desc: "换行" },
          ].map((item) => (
            <div key={item.keys} className="flex items-center justify-between">
              <span className="text-[12px] text-[--muted-foreground]">{item.desc}</span>
              <kbd className="px-2 py-0.5 rounded-md text-[11px] font-mono text-[--muted-foreground] bg-[--card] border border-[--border]">{item.keys}</kbd>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[--muted]/60 rounded-xl p-4 ring-1 ring-[--border]/50">
        <h3 className="text-[13px] font-semibold text-[--foreground] mb-1">关于</h3>
        <p className="text-[12px] text-[--muted-foreground] leading-relaxed">Data Agent — 智能数据分析助手，支持多 Agent 协作、SQL 查询、数据可视化和报告生成。</p>
        <p className="text-[11px] text-[--muted-foreground] mt-2 opacity-60">v0.1.0</p>
      </section>
    </div>
  );
}

// ─── LLM Panel ───
function LLMPanel({
  profiles, profile, editingId, activeId, showKey, onToggleKey,
  onSelect, onCreate, onDelete, onActivate, onUpdate,
}: {
  profiles: LLMProfile[];
  profile: LLMProfile;
  editingId: string | null;
  activeId: string | null;
  showKey: boolean;
  onToggleKey: () => void;
  onSelect: (id: string) => void;
  onCreate: (name: string) => string;
  onDelete: (id: string) => void;
  onActivate: (id: string) => void;
  onUpdate: (patch: LLMProfilePatch) => void;
}) {
  const llm = profile.config;
  const isActive = profile.id === activeId;
  const currentProvider = getProviderEntry(llm.provider);
  const { setRef, animate } = useCardAnimation();

  const handleProviderSwitch = (key: LLMProvider) => {
    const newProvider = PROVIDER_REGISTRY[key];
    const isCustom = key === "custom";

    onUpdate({
      config: {
        ...llm,
        provider: key,
        baseUrl: isCustom ? "" : newProvider.baseUrl,
        model: isCustom ? "" : (newProvider.models[0] || ""),
      },
    });
    animate(key);
  };

  return (
    <div className="space-y-5">
      {/* Profile bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <ChipRow items={profiles} editingId={editingId} activeId={activeId} onSelect={onSelect} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              const name = generateProfileName(currentProvider.label, profiles);
              onCreate(name);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[--primary] hover:bg-[--primary]/[0.06] active:scale-95 transition-all duration-150 cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            新建
          </button>
          {!isActive && (
            <button
              onClick={() => { onActivate(profile.id); toast.success(`已切换到「${profile.name}」`); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[--primary] text-[--primary-foreground] hover:opacity-90 active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <ChevronRight size={13} />
              启用
            </button>
          )}
          <button
            onClick={() => onDelete(profile.id)}
            aria-label="删除"
            className="p-1.5 rounded-lg text-[--muted-foreground] hover:text-[--destructive] hover:bg-[--destructive]/[0.06] cursor-pointer transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Name + badge */}
      <div className="flex items-center gap-3">
        <input
          value={profile.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="方案名称"
          className="flex-1 px-3 py-2 rounded-lg border border-[--border] bg-white text-[14px] font-medium text-[--foreground] placeholder:text-[--muted-foreground]/30 focus:outline-none focus:border-[--ring] focus:ring-2 focus:ring-[--ring]/10 transition-all duration-150"
        />
        {isActive && (
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[--success]/[0.08] text-[--success] text-[11px] font-semibold border border-[--success]/20 shrink-0">
            <Check size={11} strokeWidth={3} />
            使用中
          </span>
        )}
      </div>

      {/* Provider + credentials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <section>
            <label className={labelCls}>服务商</label>
            <div className="grid grid-cols-3 gap-2 mt-3" role="radiogroup">
              {PROVIDER_KEYS.map((key) => (
                <ProviderCard
                  key={key}
                  providerKey={key}
                  entry={PROVIDER_REGISTRY[key]}
                  selected={llm.provider === key}
                  onClick={() => handleProviderSwitch(key)}
                  animRef={setRef(key)}
                />
              ))}
            </div>
          </section>

          <section>
            <label htmlFor="llm-apikey" className={labelCls}>API Key</label>
            <div className="relative mt-2">
              <input
                id="llm-apikey"
                type={showKey ? "text" : "password"}
                value={llm.apiKey}
                onChange={(e) => onUpdate({ config: { ...llm, apiKey: e.target.value } })}
                placeholder="sk-..."
                autoComplete="off"
                className={`${fieldCls} pr-20`}
              />
              <button
                onClick={onToggleKey}
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[12px] font-medium text-[--primary] hover:text-[--primary]/80 cursor-pointer"
              >
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                {showKey ? "隐藏" : "显示"}
              </button>
            </div>
          </section>

          <section>
            <label htmlFor="llm-baseurl" className={labelCls}>Base URL</label>
            <input
              id="llm-baseurl"
              value={llm.baseUrl}
              onChange={(e) => onUpdate({ config: { ...llm, baseUrl: e.target.value } })}
              placeholder={currentProvider.baseUrl || "https://api.example.com/v1"}
              className={`mt-2 ${fieldCls}`}
            />
            {currentProvider.baseUrl && (
              <p className="text-[10px] text-[--muted-foreground]/60 mt-1 truncate">{currentProvider.baseUrl}</p>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section>
            <label htmlFor="llm-model" className={labelCls}>模型名称</label>
            {currentProvider.models.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {currentProvider.models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onUpdate({ config: { ...llm, model: m } })}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 cursor-pointer ${
                      llm.model === m
                        ? "bg-[--primary] text-[--primary-foreground] shadow-sm"
                        : "bg-[--muted]/60 text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            ) : (
              <input
                id="llm-model"
                value={llm.model}
                onChange={(e) => onUpdate({ config: { ...llm, model: e.target.value } })}
                placeholder="输入模型名称"
                className={`mt-2 ${fieldCls}`}
              />
            )}
            {currentProvider.models.length > 0 && (
              <input
                value={llm.model}
                onChange={(e) => onUpdate({ config: { ...llm, model: e.target.value } })}
                placeholder="或手动输入模型名称"
                className={`mt-2 ${fieldCls} text-[12px]`}
              />
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="llm-temp" className={labelCls}>Temperature</label>
              <span className="text-[14px] font-mono font-semibold text-[--foreground] tabular-nums bg-[--muted] px-2 py-0.5 rounded-md">{llm.temperature}</span>
            </div>
            <input
              id="llm-temp"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={llm.temperature}
              onChange={(e) => onUpdate({ config: { ...llm, temperature: parseFloat(e.target.value) } })}
              className="temp-slider w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ "--temp-pct": `${(llm.temperature / 2) * 100}%` } as React.CSSProperties}
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-[--muted-foreground]">精确</span>
              <span className="text-[10px] text-[--muted-foreground]">平衡</span>
              <span className="text-[10px] text-[--muted-foreground]">创意</span>
            </div>
            <p className="text-[11px] text-[--muted-foreground] mt-2 leading-relaxed min-h-[16px]">
              {llm.temperature <= 0.2
                ? "精确模式：适合代码生成、数据查询、数学计算等需要确定性输出的场景"
                : llm.temperature <= 0.7
                ? "平衡模式：适合日常对话、文本摘要、信息整理等通用场景"
                : llm.temperature <= 1.2
                ? "创意模式：适合文案写作、头脑风暴、创意故事等需要多样性的场景"
                : "高创意模式：输出高度随机，适合艺术创作、发散思维等极端创意场景"}
            </p>
          </section>

          <section>
            <label className={labelCls}>响应模式</label>
            <div className="relative grid grid-cols-2 gap-2 mt-3 p-1 rounded-xl bg-[--muted]/60">
              <div
                className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm ring-1 ring-[--primary]/20 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                  left: (llm.thinking_mode || "thinking") === "thinking" ? "4px" : "calc(50% + 4px)",
                  width: "calc(50% - 8px)",
                }}
              />
              {(["thinking", "fast"] as const).map((mode) => {
                const sel = (llm.thinking_mode || "thinking") === mode;
                const label = mode === "thinking" ? "思考" : "快速";
                const desc = mode === "thinking" ? "深度推理" : "直接回答";
                const Icon = mode === "thinking" ? Brain : Sparkles;
                return (
                  <button
                    key={mode}
                    onClick={() => onUpdate({ config: { ...llm, thinking_mode: mode } })}
                    className={`relative z-10 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                      sel ? "text-[--foreground]" : "text-[--muted-foreground] hover:text-[--foreground]/70"
                    }`}
                  >
                    <Icon size={15} className={`transition-colors duration-200 ${sel ? "text-[--primary]" : ""}`} />
                    <span className="text-[13px] font-medium">{label}</span>
                    <span className={`text-[10px] ${sel ? "text-[--muted-foreground]" : "text-[--muted-foreground]/50"}`}>{desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="bg-[--muted]/60 rounded-xl p-4 ring-1 ring-[--border]/50">
            <div className="flex items-start gap-2.5">
              <Info size={14} className="shrink-0 mt-0.5 text-[--muted-foreground]" />
              <div>
                <p className="text-[12px] font-medium text-[--foreground]">提示</p>
                <p className="text-[11px] text-[--muted-foreground] mt-0.5 leading-relaxed">
                  切换服务商时，Base URL 和模型会自动填充为对应默认值。支持 OpenAI 兼容 API 格式。
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── DB Panel ───
function DBPanel({
  profiles, profile, editingId, activeId, testing, testResult,
  onSelect, onCreate, onDelete, onActivate, onUpdate, onTest, onResetTest,
}: {
  profiles: DBProfile[];
  profile: DBProfile;
  editingId: string | null;
  activeId: string | null;
  testing: boolean;
  testResult: "ok" | "fail" | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => string;
  onDelete: (id: string) => void;
  onActivate: (id: string) => void;
  onUpdate: (patch: DBProfilePatch) => void;
  onTest: () => void;
  onResetTest: () => void;
}) {
  const db = profile.config;
  const isActive = profile.id === activeId;
  const isServerDB = isServerDBConfig(db);
  const currentDBEntry = DB_TYPE_REGISTRY[db.type];
  const { setRef, animate } = useCardAnimation();

  const handleDBTypeSwitch = (type: DBType) => {
    onUpdate({ config: defaultDBConfig(type) });
    onResetTest();
    animate(type);
  };

  return (
    <div className="space-y-5">
      {/* Profile bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <ChipRow items={profiles} editingId={editingId} activeId={activeId} onSelect={onSelect} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              const name = generateProfileName(currentDBEntry.label, profiles);
              onCreate(name);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[--primary] hover:bg-[--primary]/[0.06] active:scale-95 transition-all duration-150 cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            新建
          </button>
          {!isActive && (
            <button
              onClick={() => { onActivate(profile.id); toast.success(`已切换到「${profile.name}」`); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[--primary] text-[--primary-foreground] hover:opacity-90 active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <ChevronRight size={13} />
              启用
            </button>
          )}
          <button
            onClick={() => onDelete(profile.id)}
            aria-label="删除"
            className="p-1.5 rounded-lg text-[--muted-foreground] hover:text-[--destructive] hover:bg-[--destructive]/[0.06] cursor-pointer transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Name + badge */}
      <div className="flex items-center gap-3">
        <input
          value={profile.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="数据库名称"
          className="flex-1 px-3 py-2 rounded-lg border border-[--border] bg-white text-[14px] font-medium text-[--foreground] placeholder:text-[--muted-foreground]/30 focus:outline-none focus:border-[--ring] focus:ring-2 focus:ring-[--ring]/10 transition-all duration-150"
        />
        {isActive && (
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[--success]/[0.08] text-[--success] text-[11px] font-semibold border border-[--success]/20 shrink-0">
            <Check size={11} strokeWidth={3} />
            使用中
          </span>
        )}
      </div>

      {/* DB Type */}
      <section>
        <label className={labelCls}>数据库类型</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3" role="radiogroup">
          {DB_TYPES.map(([typeKey, entry]) => (
            <DBTypeCard
              key={typeKey}
              typeKey={typeKey}
              entry={entry}
              selected={db.type === typeKey}
              onClick={() => handleDBTypeSwitch(typeKey)}
              animRef={setRef(typeKey)}
            />
          ))}
        </div>
      </section>

      {/* Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {isServerDB ? (
            <>
              <div className="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_120px] gap-3">
                <div>
                  <label htmlFor="db-host" className={labelCls}>主机</label>
                  <input id="db-host" value={db.host} onChange={(e) => onUpdate({ config: { ...db, host: e.target.value } })} placeholder="localhost" className={`mt-2 ${fieldCls}`} />
                </div>
                <div>
                  <label htmlFor="db-port" className={labelCls}>端口</label>
                  <input id="db-port" value={db.port} onChange={(e) => onUpdate({ config: { ...db, port: e.target.value } })} placeholder={db.type === "mysql" ? "3306" : "5432"} className={`mt-2 ${fieldCls}`} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="db-user" className={labelCls}>用户名</label>
                  <input id="db-user" value={db.user} onChange={(e) => onUpdate({ config: { ...db, user: e.target.value } })} placeholder={db.type === "mysql" ? "root" : "postgres"} className={`mt-2 ${fieldCls}`} />
                </div>
                <div>
                  <label htmlFor="db-pass" className={labelCls}>密码</label>
                  <input id="db-pass" type="password" value={db.password} onChange={(e) => onUpdate({ config: { ...db, password: e.target.value } })} placeholder="••••••" autoComplete="off" className={`mt-2 ${fieldCls}`} />
                </div>
              </div>
              <div>
                <label htmlFor="db-name" className={labelCls}>数据库名</label>
                <input id="db-name" value={db.database} onChange={(e) => onUpdate({ config: { ...db, database: e.target.value } })} placeholder="my_database" className={`mt-2 ${fieldCls}`} />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="db-file" className={labelCls}>
                {db.type === "sqlite" ? "SQLite 文件路径" : "DuckDB 文件路径"}
              </label>
              <input
                id="db-file"
                value={db.filePath}
                onChange={(e) => onUpdate({ config: { ...db, filePath: e.target.value } })}
                placeholder={db.type === "sqlite" ? "/path/to/data.db" : "/path/to/data.duckdb"}
                className={`mt-2 ${fieldCls}`}
              />
            </div>
          )}
        </div>

        <section className="bg-[--muted]/60 rounded-xl p-4 ring-1 ring-[--border]/50 flex flex-col justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-[--foreground]">连接测试</h3>
            <p className="text-[11px] text-[--muted-foreground] mt-0.5 leading-relaxed">验证数据库是否可正常连接。</p>
          </div>
          <div className="flex items-center gap-3 mt-4">
            {testResult === "ok" && (
              <span className="flex items-center gap-1.5 text-[12px] text-[--success] font-semibold">
                <Check size={14} strokeWidth={2.5} />
                成功
              </span>
            )}
            {testResult === "fail" && (
              <span className="flex items-center gap-1.5 text-[12px] text-[--destructive] font-semibold">
                <X size={14} strokeWidth={2.5} />
                失败
              </span>
            )}
            <button
              onClick={onTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold bg-[--primary] text-[--primary-foreground] hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95 transition-all duration-150"
            >
              {testing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RotateCcw size={13} />
              )}
              {testing ? "测试中..." : "测试连接"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
