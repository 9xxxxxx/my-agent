"use client";

import { useState } from "react";
import { useConnectionStore, type DBType, type LLMProfile, type DBProfile } from "@/stores/connection";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { testConnection } from "@/lib/api";
import { toast } from "sonner";

const fieldCls =
  "w-full px-3 py-2.5 rounded-md border border-[--border] bg-white text-[14px] text-[--foreground] placeholder:text-[--muted-foreground]/40 focus:outline-none focus:border-[--ring] transition-all duration-150";

const labelCls = "text-[11px] font-semibold text-[--muted-foreground] uppercase tracking-[0.05em]";

const DB_TYPES: { value: DBType; label: string }[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "duckdb", label: "DuckDB" },
];

const PROVIDERS: { key: string; label: string; color: string }[] = [
  { key: "deepseek", label: "DeepSeek", color: "#3b82f6" },
  { key: "openai", label: "OpenAI", color: "#10b981" },
  { key: "custom", label: "自定义", color: "#8b5cf6" },
];

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  custom: { baseUrl: "", model: "" },
};

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
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const editing = item.id === editingId;
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
              editing
                ? "bg-[--muted] text-[--foreground]"
                : "text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]"
            }`}
          >
            {active && <span className="w-1.5 h-1.5 rounded-full bg-[--success] shrink-0" />}
            {item.name}
          </button>
        );
      })}
    </div>
  );
}

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
  const assembleDbUrl = useConnectionStore((s) => s.assembleDbUrl);

  const llmProfile = llmProfiles.find((p) => p.id === editingLLMId) || llmProfiles[0];
  const dbProfile = dbProfiles.find((p) => p.id === editingDBId) || dbProfiles[0];

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [activeTab, setActiveTab] = useState<"llm" | "db">("llm");

  if (!llmProfile || !dbProfile) return null;

  const llm = llmProfile.config;
  const db = dbProfile.config;
  const isServerDB = db.type === "postgresql" || db.type === "mysql";

  const handleTestConnection = async () => {
    const url = assembleDbUrl(dbProfile);
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
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-[--border]">
        <div>
          <h2 className="text-[16px] font-semibold text-[--foreground]">连接配置</h2>
          <p className="text-[12px] text-[--muted-foreground] mt-0.5">LLM 模型和数据库连接独立管理</p>
        </div>
        <button onClick={onClose} aria-label="关闭" className="p-1.5 rounded-md hover:bg-[--muted] text-[--muted-foreground] hover:text-[--foreground] cursor-pointer transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* ─── Tabs ─── */}
      <div className="px-4 sm:px-8 pt-4 sm:pt-5">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "llm" | "db")}>
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="llm" className="flex-1 text-[13px] py-2 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 opacity-50"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              LLM 模型
            </TabsTrigger>
            <TabsTrigger value="db" className="flex-1 text-[13px] py-2 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 opacity-50"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              数据库
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ─── Tab content ─── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-5">
        {activeTab === "llm" ? (
          <LLMPanel
            profiles={llmProfiles}
            profile={llmProfile}
            editingId={editingLLMId}
            activeId={activeLLMId}
            showKey={showKey}
            onToggleKey={() => setShowKey(!showKey)}
            onSelect={setEditingLLM}
            onCreate={createLLM}
            onDelete={deleteLLM}
            onActivate={setActiveLLM}
            onUpdate={(patch) => updateLLM(llmProfile.id, patch)}
          />
        ) : (
          <DBPanel
            profiles={dbProfiles}
            profile={dbProfile}
            editingId={editingDBId}
            activeId={activeDBId}
            testing={testing}
            testResult={testResult}
            onSelect={setEditingDB}
            onCreate={createDB}
            onDelete={deleteDB}
            onActivate={setActiveDB}
            onUpdate={(patch) => updateDB(dbProfile.id, patch)}
            onTest={handleTestConnection}
            onResetTest={() => setTestResult(null)}
          />
        )}
      </div>

      {/* ─── Footer ─── */}
      <div className="px-4 sm:px-8 py-3 border-t border-[--border] flex items-center justify-between gap-3">
        <span className="hidden sm:inline text-[11px] text-[--muted-foreground]">配置自动保存</span>
        <span className="sm:hidden" />
        <button onClick={onClose} className="px-5 py-2 rounded-md text-[13px] font-semibold bg-[--primary] text-[--primary-foreground] hover:opacity-90 cursor-pointer transition-opacity">完成</button>
      </div>
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
  onUpdate: (patch: any) => void;
}) {
  const llm = profile.config;
  const isActive = profile.id === activeId;

  return (
    <div className="space-y-5">
      {/* Profile bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <ChipRow items={profiles} editingId={editingId} activeId={activeId} onSelect={onSelect} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onCreate(`LLM ${profiles.length + 1}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-[--primary] hover:bg-[--primary]/[0.06] transition-colors cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新建
          </button>
          {!isActive && (
            <button onClick={() => { onActivate(profile.id); toast.success(`已切换到「${profile.name}」`); }} className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[--primary] text-[--primary-foreground] hover:opacity-90 transition-colors cursor-pointer">启用</button>
          )}
          <button onClick={() => onDelete(profile.id)} aria-label="删除" className="p-1.5 rounded-md text-[--muted-foreground] hover:text-[--destructive] hover:bg-[--destructive]/[0.06] cursor-pointer transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      {/* Name + badge */}
      <div className="flex items-center gap-3">
        <input value={profile.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="方案名称"
          className="flex-1 px-3 py-2 rounded-md border border-[--border] bg-white text-[14px] font-medium text-[--foreground] placeholder:text-[--muted-foreground]/30 focus:outline-none focus:border-[--ring] transition-all duration-150" />
        {isActive && <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[--success]/[0.08] text-[--success] text-[11px] font-semibold border border-[--success]/20 shrink-0">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>使用中
        </span>}
      </div>

      {/* Provider + credentials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <section>
            <label className={labelCls}>服务商</label>
            <div className="grid grid-cols-3 gap-2 mt-3" role="radiogroup">
              {PROVIDERS.map((p) => {
                const sel = llm.provider === p.key;
                return (
                  <button key={p.key} onClick={() => onUpdate({ config: { ...llm, provider: p.key as any, ...PROVIDER_DEFAULTS[p.key] } })}
                    role="radio" aria-checked={sel}
                    className={`flex flex-col items-center gap-2 py-3 rounded-lg border transition-all duration-150 cursor-pointer ${sel ? "border-[--primary] bg-[--primary]/[0.03]" : "border-transparent bg-[--muted] hover:bg-[--border]"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold text-white transition-transform duration-150 ${sel ? "scale-105" : ""}`}
                      style={{ background: p.color }}>{p.label[0]}</div>
                    <span className={`text-[13px] font-medium ${sel ? "text-[--foreground]" : "text-[--muted-foreground]"}`}>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <section>
            <label htmlFor="llm-apikey" className={labelCls}>API Key</label>
            <div className="relative mt-2">
              <input id="llm-apikey" type={showKey ? "text" : "password"} value={llm.apiKey} onChange={(e) => onUpdate({ config: { ...llm, apiKey: e.target.value } })}
                placeholder="sk-..." autoComplete="off" className={`${fieldCls} pr-16`} />
              <button onClick={onToggleKey} type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[--primary] hover:text-[--primary]/80 cursor-pointer">{showKey ? "隐藏" : "显示"}</button>
            </div>
          </section>
          <section>
            <label htmlFor="llm-baseurl" className={labelCls}>Base URL</label>
            <input id="llm-baseurl" value={llm.baseUrl} onChange={(e) => onUpdate({ config: { ...llm, baseUrl: e.target.value } })}
              placeholder="https://api.openai.com/v1" className={`mt-2 ${fieldCls}`} />
          </section>
        </div>
        <div className="space-y-5">
          <section>
            <label htmlFor="llm-model" className={labelCls}>模型名称</label>
            <input id="llm-model" value={llm.model} onChange={(e) => onUpdate({ config: { ...llm, model: e.target.value } })}
              placeholder="deepseek-chat" className={`mt-2 ${fieldCls}`} />
          </section>
          <section>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="llm-temp" className={labelCls}>Temperature</label>
              <span className="text-[14px] font-mono font-semibold text-[--foreground] tabular-nums">{llm.temperature}</span>
            </div>
            <input id="llm-temp" type="range" min={0} max={2} step={0.1} value={llm.temperature}
              onChange={(e) => onUpdate({ config: { ...llm, temperature: parseFloat(e.target.value) } })}
              className="w-full h-1.5 bg-[--muted] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[--primary] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white" />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[--muted-foreground]">精确 0</span>
              <span className="text-[10px] text-[--muted-foreground]">创意 2</span>
            </div>
          </section>
          <section className="bg-[--muted] rounded-lg p-4">
            <div className="flex items-start gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <div>
                <p className="text-[12px] font-medium text-[--foreground]">提示</p>
                <p className="text-[11px] text-[--muted-foreground] mt-0.5 leading-relaxed">LLM 配置独立于数据库配置，可自由组合使用。</p>
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
  onUpdate: (patch: any) => void;
  onTest: () => void;
  onResetTest: () => void;
}) {
  const db = profile.config;
  const isActive = profile.id === activeId;
  const isServerDB = db.type === "postgresql" || db.type === "mysql";

  return (
    <div className="space-y-5">
      {/* Profile bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <ChipRow items={profiles} editingId={editingId} activeId={activeId} onSelect={onSelect} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onCreate(`数据库 ${profiles.length + 1}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-[--primary] hover:bg-[--primary]/[0.06] transition-colors cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新建
          </button>
          {!isActive && (
            <button onClick={() => { onActivate(profile.id); toast.success(`已切换到「${profile.name}」`); }} className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[--primary] text-[--primary-foreground] hover:opacity-90 transition-colors cursor-pointer">启用</button>
          )}
          <button onClick={() => onDelete(profile.id)} aria-label="删除" className="p-1.5 rounded-md text-[--muted-foreground] hover:text-[--destructive] hover:bg-[--destructive]/[0.06] cursor-pointer transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      {/* Name + badge */}
      <div className="flex items-center gap-3">
        <input value={profile.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="数据库名称"
          className="flex-1 px-3 py-2 rounded-md border border-[--border] bg-white text-[14px] font-medium text-[--foreground] placeholder:text-[--muted-foreground]/30 focus:outline-none focus:border-[--ring] transition-all duration-150" />
        {isActive && <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[--success]/[0.08] text-[--success] text-[11px] font-semibold border border-[--success]/20 shrink-0">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>使用中
        </span>}
      </div>

      {/* DB Type */}
      <section>
        <label className={labelCls}>数据库类型</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3" role="radiogroup">
          {DB_TYPES.map((t) => {
            const sel = db.type === t.value;
            return (
              <button key={t.value} onClick={() => {
                if (t.value === "sqlite" || t.value === "duckdb") onUpdate({ config: { ...db, type: t.value, filePath: "" } as any });
                else onUpdate({ config: { ...db, type: t.value, host: "localhost", port: t.value === "mysql" ? "3306" : "5432", user: "", password: "", database: "" } as any });
                onResetTest();
              }} role="radio" aria-checked={sel}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all duration-150 cursor-pointer ${sel ? "border-[--primary] bg-[--primary]/[0.03]" : "border-transparent bg-[--muted] hover:bg-[--border]"}`}>
                <div className={`w-8 h-8 rounded-full bg-[#374151] flex items-center justify-center text-[13px] font-bold text-white transition-transform duration-150 ${sel ? "scale-105" : ""}`}>{t.label[0]}</div>
                <span className={`text-[12px] font-medium ${sel ? "text-[--foreground]" : "text-[--muted-foreground]"}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {isServerDB ? (
            <>
              <div className="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_120px] gap-3">
                <div><label htmlFor="db-host" className={labelCls}>主机</label><input id="db-host" value={(db as any).host || ""} onChange={(e) => onUpdate({ config: { ...db, host: e.target.value } as any })} placeholder="localhost" className={`mt-2 ${fieldCls}`} /></div>
                <div><label htmlFor="db-port" className={labelCls}>端口</label><input id="db-port" value={(db as any).port || ""} onChange={(e) => onUpdate({ config: { ...db, port: e.target.value } as any })} placeholder={db.type === "mysql" ? "3306" : "5432"} className={`mt-2 ${fieldCls}`} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label htmlFor="db-user" className={labelCls}>用户名</label><input id="db-user" value={(db as any).user || ""} onChange={(e) => onUpdate({ config: { ...db, user: e.target.value } as any })} placeholder="postgres" className={`mt-2 ${fieldCls}`} /></div>
                <div><label htmlFor="db-pass" className={labelCls}>密码</label><input id="db-pass" type="password" value={(db as any).password || ""} onChange={(e) => onUpdate({ config: { ...db, password: e.target.value } as any })} placeholder="••••••" autoComplete="off" className={`mt-2 ${fieldCls}`} /></div>
              </div>
              <div><label htmlFor="db-name" className={labelCls}>数据库名</label><input id="db-name" value={(db as any).database || ""} onChange={(e) => onUpdate({ config: { ...db, database: e.target.value } as any })} placeholder="my_database" className={`mt-2 ${fieldCls}`} /></div>
            </>
          ) : (
            <div>
              <label htmlFor="db-file" className={labelCls}>{db.type === "sqlite" ? "SQLite 文件路径" : "DuckDB 文件路径"}</label>
              <input id="db-file" value={(db as any).filePath || ""} onChange={(e) => onUpdate({ config: { ...db, filePath: e.target.value } as any })} placeholder={db.type === "sqlite" ? "/path/to/data.db" : "/path/to/data.duckdb"} className={`mt-2 ${fieldCls}`} />
            </div>
          )}
        </div>
        <section className="bg-[--muted] rounded-lg p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-[--foreground]">连接测试</h3>
            <p className="text-[11px] text-[--muted-foreground] mt-0.5 leading-relaxed">验证数据库是否可正常连接。</p>
          </div>
          <div className="flex items-center gap-3 mt-3">
            {testResult === "ok" && <span className="flex items-center gap-1.5 text-[12px] text-[--success] font-semibold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>成功</span>}
            {testResult === "fail" && <span className="flex items-center gap-1.5 text-[12px] text-[--destructive] font-semibold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>失败</span>}
            <button onClick={onTest} disabled={testing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold bg-[--primary] text-[--primary-foreground] hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-all duration-150">
              {testing ? <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              {testing ? "测试中..." : "测试连接"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
