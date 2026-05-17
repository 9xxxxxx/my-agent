import { create } from "zustand";
import type { LLMConfig } from "./chat";
import {
  fetchLLMProfiles,
  saveLLMProfile,
  updateLLMProfile,
  deleteLLMProfileApi,
  activateLLMProfile,
  fetchDBProfiles,
  saveDBProfile,
  updateDBProfile,
  deleteDBProfileApi,
  activateDBProfile,
} from "@/lib/api";

// ─── Database types ───

export type ServerDBType = "postgresql" | "mysql";
export type FileDBType = "sqlite" | "duckdb";
export type DBType = ServerDBType | FileDBType;

export interface ServerDBConfig {
  type: ServerDBType;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

export interface FileDBConfig {
  type: FileDBType;
  filePath: string;
}

export type DBConfig = ServerDBConfig | FileDBConfig;

// ─── Separate profiles ───

export interface LLMProfile {
  id: string;
  name: string;
  config: LLMConfig;
  createdAt: number;
}

export interface DBProfile {
  id: string;
  name: string;
  config: DBConfig;
  createdAt: number;
}

// ─── Store ───

interface ConnectionState {
  llmProfiles: LLMProfile[];
  dbProfiles: DBProfile[];
  activeLLMId: string | null;
  activeDBId: string | null;
  editingLLMId: string | null;
  editingDBId: string | null;
  fontSize: number; // 14-22
  mode: "dev" | "prod";

  // LLM CRUD
  createLLM: (name: string) => string;
  updateLLM: (id: string, patch: Partial<Omit<LLMProfile, "id" | "createdAt">>) => void;
  deleteLLM: (id: string) => void;
  setActiveLLM: (id: string) => void;
  setEditingLLM: (id: string | null) => void;

  // DB CRUD
  createDB: (name: string) => string;
  updateDB: (id: string, patch: Partial<Omit<DBProfile, "id" | "createdAt">>) => void;
  deleteDB: (id: string) => void;
  setActiveDB: (id: string) => void;
  setEditingDB: (id: string | null) => void;

  // UI
  setFontSize: (size: number) => void;
  setMode: (mode: "dev" | "prod") => void;

  // Selectors
  getActiveLLM: () => LLMProfile | null;
  getActiveDB: () => DBProfile | null;
  getEditingLLM: () => LLMProfile | null;
  getEditingDB: () => DBProfile | null;
  assembleDbUrl: (profile?: DBProfile) => string;
}

// ─── Storage keys ───
const LLM_KEY = "llm-profiles";
const LLM_ACTIVE = "llm-active-id";
const DB_KEY = "db-profiles";
const DB_ACTIVE = "db-active-id";
const FONT_SIZE_KEY = "chat-font-size";
const MODE_KEY = "chat-mode";

// ─── Defaults ───
const defaultLLM: LLMConfig = {
  provider: "deepseek",
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  temperature: 0,
};

const defaultDB: DBConfig = {
  type: "postgresql",
  host: "localhost",
  port: "5432",
  user: "",
  password: "",
  database: "",
};

// ─── Helpers ───
function createLLMProfile(name: string): LLMProfile {
  return { id: crypto.randomUUID(), name, config: { ...defaultLLM }, createdAt: Date.now() };
}

function createDBProfile(name: string): DBProfile {
  return { id: crypto.randomUUID(), name, config: { ...defaultDB }, createdAt: Date.now() };
}

function assembleDbUrl(profile: DBProfile): string {
  const { config } = profile;
  switch (config.type) {
    case "postgresql":
      return `postgresql+psycopg2://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
    case "mysql":
      return `mysql+pymysql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
    case "sqlite":
      return `sqlite:///${config.filePath}`;
    case "duckdb":
      return `duckdb:///${config.filePath}`;
    default:
      return "";
  }
}

// ─── Load helpers ───
function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

// ─── Migration from old combined profiles ───
function migrate(): { llmProfiles: LLMProfile[]; dbProfiles: DBProfile[]; llmActive: string | null; dbActive: string | null } {
  const savedLLM = loadJSON<LLMProfile[]>(LLM_KEY, []);
  const savedDB = loadJSON<DBProfile[]>(DB_KEY, []);

  if (savedLLM.length > 0 || savedDB.length > 0) {
    return {
      llmProfiles: savedLLM.length > 0 ? savedLLM : [createLLMProfile("默认 LLM")],
      dbProfiles: savedDB.length > 0 ? savedDB : [createDBProfile("默认数据库")],
      llmActive: loadJSON(LLM_ACTIVE, null) || savedLLM[0]?.id || null,
      dbActive: loadJSON(DB_ACTIVE, null) || savedDB[0]?.id || null,
    };
  }

  // Migrate from old combined "connection-profiles"
  const old = loadJSON<any[]>("connection-profiles", []);
  if (old.length > 0) {
    const llmProfiles: LLMProfile[] = old.map((p) => ({
      id: p.id,
      name: p.name,
      config: p.llm || { ...defaultLLM },
      createdAt: p.createdAt || Date.now(),
    }));
    const dbProfiles: DBProfile[] = old.map((p) => ({
      id: p.id,
      name: p.name,
      config: p.db || { ...defaultDB },
      createdAt: p.createdAt || Date.now(),
    }));
    const llmActive = llmProfiles[0].id;
    const dbActive = dbProfiles[0].id;
    localStorage.removeItem("connection-profiles");
    localStorage.removeItem("active-profile-id");
    return { llmProfiles, dbProfiles, llmActive, dbActive };
  }

  // Fresh start
  const llm0 = createLLMProfile("默认 LLM");
  const db0 = createDBProfile("默认数据库");
  return { llmProfiles: [llm0], dbProfiles: [db0], llmActive: llm0.id, dbActive: db0.id };
}

// ─── Init ───
const init = migrate();

// ─── Backend sync ───
async function syncFromBackend() {
  try {
    const [llmRows, dbRows] = await Promise.all([fetchLLMProfiles(), fetchDBProfiles()]);

    if (llmRows.length > 0) {
      const llmProfiles: LLMProfile[] = llmRows.map((r) => ({
        id: r.id,
        name: r.name,
        config: r.config as unknown as LLMConfig,
        createdAt: r.created_at,
      }));
      const activeLLMId = llmRows.find((r) => r.is_active)?.id || llmProfiles[0].id;
      useConnectionStore.setState({ llmProfiles, activeLLMId, editingLLMId: activeLLMId });
      saveJSON(LLM_KEY, llmProfiles);
      saveJSON(LLM_ACTIVE, activeLLMId);
    }

    if (dbRows.length > 0) {
      const dbProfiles: DBProfile[] = dbRows.map((r) => ({
        id: r.id,
        name: r.name,
        config: r.config as unknown as DBConfig,
        createdAt: r.created_at,
      }));
      const activeDBId = dbRows.find((r) => r.is_active)?.id || dbProfiles[0].id;
      useConnectionStore.setState({ dbProfiles, activeDBId, editingDBId: activeDBId });
      saveJSON(DB_KEY, dbProfiles);
      saveJSON(DB_ACTIVE, activeDBId);
    }
  } catch {
    // Backend unavailable, use localStorage
  }
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  llmProfiles: init.llmProfiles,
  dbProfiles: init.dbProfiles,
  activeLLMId: init.llmActive,
  activeDBId: init.dbActive,
  editingLLMId: init.llmActive,
  editingDBId: init.dbActive,
  fontSize: loadJSON(FONT_SIZE_KEY, 17),
  mode: loadJSON(MODE_KEY, "prod"),

  // ── LLM ──

  createLLM: (name) => {
    const profile = createLLMProfile(name);
    set((s) => {
      const llmProfiles = [...s.llmProfiles, profile];
      saveJSON(LLM_KEY, llmProfiles);
      saveJSON(LLM_ACTIVE, profile.id);
      return { llmProfiles, activeLLMId: profile.id, editingLLMId: profile.id };
    });
    saveLLMProfile({
      id: profile.id,
      name: profile.name,
      config: profile.config as unknown as Record<string, unknown>,
      is_active: true,
      created_at: profile.createdAt,
    });
    return profile.id;
  },

  updateLLM: (id, patch) => {
    set((s) => {
      const llmProfiles = s.llmProfiles.map((p) =>
        p.id === id ? { ...p, ...patch, config: { ...p.config, ...patch.config } } : p,
      );
      saveJSON(LLM_KEY, llmProfiles);
      return { llmProfiles };
    });
    updateLLMProfile(id, {
      name: patch.name,
      config: patch.config as unknown as Record<string, unknown>,
    });
  },

  deleteLLM: (id) => {
    set((s) => {
      const llmProfiles = s.llmProfiles.filter((p) => p.id !== id);
      let activeId = s.activeLLMId;
      let editingId = s.editingLLMId;

      if (llmProfiles.length === 0) {
        const fallback = createLLMProfile("默认 LLM");
        llmProfiles.push(fallback);
        activeId = fallback.id;
        editingId = fallback.id;
        saveLLMProfile({
          id: fallback.id,
          name: fallback.name,
          config: fallback.config as unknown as Record<string, unknown>,
          is_active: true,
          created_at: fallback.createdAt,
        });
      } else if (activeId === id) {
        activeId = llmProfiles[0].id;
        editingId = activeId;
      } else if (editingId === id) {
        editingId = activeId;
      }

      saveJSON(LLM_KEY, llmProfiles);
      saveJSON(LLM_ACTIVE, activeId);
      return { llmProfiles, activeLLMId: activeId, editingLLMId: editingId };
    });
    deleteLLMProfileApi(id);
  },

  setActiveLLM: (id) => {
    set({ activeLLMId: id });
    saveJSON(LLM_ACTIVE, id);
    activateLLMProfile(id);
  },

  setEditingLLM: (id) => set({ editingLLMId: id }),

  // ── DB ──

  createDB: (name) => {
    const profile = createDBProfile(name);
    set((s) => {
      const dbProfiles = [...s.dbProfiles, profile];
      saveJSON(DB_KEY, dbProfiles);
      saveJSON(DB_ACTIVE, profile.id);
      return { dbProfiles, activeDBId: profile.id, editingDBId: profile.id };
    });
    saveDBProfile({
      id: profile.id,
      name: profile.name,
      config: profile.config as unknown as Record<string, unknown>,
      is_active: true,
      created_at: profile.createdAt,
    });
    return profile.id;
  },

  updateDB: (id, patch) => {
    set((s) => {
      const dbProfiles = s.dbProfiles.map((p) =>
        p.id === id ? { ...p, ...patch, config: { ...p.config, ...patch.config } } : p,
      );
      saveJSON(DB_KEY, dbProfiles);
      return { dbProfiles };
    });
    updateDBProfile(id, {
      name: patch.name,
      config: patch.config as unknown as Record<string, unknown>,
    });
  },

  deleteDB: (id) => {
    set((s) => {
      const dbProfiles = s.dbProfiles.filter((p) => p.id !== id);
      let activeId = s.activeDBId;
      let editingId = s.editingDBId;

      if (dbProfiles.length === 0) {
        const fallback = createDBProfile("默认数据库");
        dbProfiles.push(fallback);
        activeId = fallback.id;
        editingId = fallback.id;
        saveDBProfile({
          id: fallback.id,
          name: fallback.name,
          config: fallback.config as unknown as Record<string, unknown>,
          is_active: true,
          created_at: fallback.createdAt,
        });
      } else if (activeId === id) {
        activeId = dbProfiles[0].id;
        editingId = activeId;
      } else if (editingId === id) {
        editingId = activeId;
      }

      saveJSON(DB_KEY, dbProfiles);
      saveJSON(DB_ACTIVE, activeId);
      return { dbProfiles, activeDBId: activeId, editingDBId: editingId };
    });
    deleteDBProfileApi(id);
  },

  setActiveDB: (id) => {
    set({ activeDBId: id });
    saveJSON(DB_ACTIVE, id);
    activateDBProfile(id);
  },

  setEditingDB: (id) => set({ editingDBId: id }),

  setFontSize: (size) => {
    const clamped = Math.max(14, Math.min(22, size));
    set({ fontSize: clamped });
    saveJSON(FONT_SIZE_KEY, clamped);
  },

  setMode: (mode) => {
    set({ mode });
    saveJSON(MODE_KEY, mode);
  },

  // ── Selectors ──

  getActiveLLM: () => {
    const { llmProfiles, activeLLMId } = get();
    return llmProfiles.find((p) => p.id === activeLLMId) || llmProfiles[0] || null;
  },

  getActiveDB: () => {
    const { dbProfiles, activeDBId } = get();
    return dbProfiles.find((p) => p.id === activeDBId) || dbProfiles[0] || null;
  },

  getEditingLLM: () => {
    const { llmProfiles, editingLLMId } = get();
    return llmProfiles.find((p) => p.id === editingLLMId) || llmProfiles[0] || null;
  },

  getEditingDB: () => {
    const { dbProfiles, editingDBId } = get();
    return dbProfiles.find((p) => p.id === editingDBId) || dbProfiles[0] || null;
  },

  assembleDbUrl: (profile) => {
    const p = profile || get().getActiveDB();
    return p ? assembleDbUrl(p) : "";
  },
}));

// Sync from backend on client init
if (typeof window !== "undefined") {
  syncFromBackend();
}
