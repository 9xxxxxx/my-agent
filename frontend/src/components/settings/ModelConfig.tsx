"use client";

import { useChatStore, type LLMConfig } from "@/stores/chat";
import { useState } from "react";
import { toast } from "sonner";

const PROVIDERS: Record<string, Partial<LLMConfig>> = {
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  custom: { baseUrl: "", model: "" },
};

export default function ModelConfig() {
  const llmConfig = useChatStore((s) => s.llmConfig);
  const setLLMConfig = useChatStore((s) => s.setLLMConfig);
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="p-5 space-y-5">
      {/* Provider */}
      <div className="space-y-2">
        <label className="text-[12px] font-medium text-[#5a5a52] uppercase tracking-wider">Provider</label>
        <div className="flex gap-1.5">
          {Object.keys(PROVIDERS).map((p) => (
            <button
              key={p}
              onClick={() => setLLMConfig({ provider: p as LLMConfig["provider"], ...PROVIDERS[p] })}
              className={`flex-1 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                llmConfig.provider === p
                  ? "bg-[#2d2d2d] text-white"
                  : "bg-[#f0efed] text-[#5a5a52] hover:bg-[#e8e7e4]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <label className="text-[12px] font-medium text-[#5a5a52] uppercase tracking-wider">API Key</label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={llmConfig.apiKey}
            onChange={(e) => setLLMConfig({ apiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full px-3 py-2 rounded-lg border border-[#e5e4e1] bg-white text-[13px] text-[#1a1a1a] placeholder:text-[#b0afa8] focus:outline-none focus:border-[#b0afa8] pr-14"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#9a9a92] hover:text-[#5a5a52]"
          >
            {showKey ? "隐藏" : "显示"}
          </button>
        </div>
      </div>

      {/* Base URL */}
      <div className="space-y-2">
        <label className="text-[12px] font-medium text-[#5a5a52] uppercase tracking-wider">API Base URL</label>
        <input
          value={llmConfig.baseUrl}
          onChange={(e) => setLLMConfig({ baseUrl: e.target.value })}
          placeholder="https://api.openai.com/v1"
          className="w-full px-3 py-2 rounded-lg border border-[#e5e4e1] bg-white text-[13px] text-[#1a1a1a] placeholder:text-[#b0afa8] focus:outline-none focus:border-[#b0afa8]"
        />
      </div>

      {/* Model */}
      <div className="space-y-2">
        <label className="text-[12px] font-medium text-[#5a5a52] uppercase tracking-wider">模型</label>
        <input
          value={llmConfig.model}
          onChange={(e) => setLLMConfig({ model: e.target.value })}
          placeholder="deepseek-chat"
          className="w-full px-3 py-2 rounded-lg border border-[#e5e4e1] bg-white text-[13px] text-[#1a1a1a] placeholder:text-[#b0afa8] focus:outline-none focus:border-[#b0afa8]"
        />
      </div>

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[12px] font-medium text-[#5a5a52] uppercase tracking-wider">Temperature</label>
          <span className="text-[12px] text-[#9a9a92] font-mono">{llmConfig.temperature}</span>
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={llmConfig.temperature}
          onChange={(e) => setLLMConfig({ temperature: parseFloat(e.target.value) })}
          className="w-full h-1 bg-[#e5e4e1] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2d2d2d] [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>

      <button
        onClick={() => toast.success("配置已保存")}
        className="w-full py-2.5 rounded-lg bg-[#2d2d2d] text-white text-[13px] font-medium hover:bg-[#1a1a1a] transition-colors"
      >
        保存配置
      </button>
    </div>
  );
}
