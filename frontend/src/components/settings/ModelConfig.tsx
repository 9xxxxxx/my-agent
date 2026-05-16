"use client";

import { useChatStore, type LLMConfig } from "@/stores/chat";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-medium">模型配置</h3>

      {/* Provider 选择 */}
      <div className="space-y-2">
        <Label className="text-xs">Provider</Label>
        <div className="flex gap-1">
          {Object.keys(PROVIDERS).map((p) => (
            <Button
              key={p}
              variant={llmConfig.provider === p ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setLLMConfig({ provider: p as LLMConfig["provider"], ...PROVIDERS[p] })
              }
              className="flex-1 text-xs"
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <Label className="text-xs">API Key</Label>
        <div className="relative">
          <Input
            type={showKey ? "text" : "password"}
            value={llmConfig.apiKey}
            onChange={(e) => setLLMConfig({ apiKey: e.target.value })}
            placeholder="sk-..."
            className="text-xs pr-16"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
          >
            {showKey ? "隐藏" : "显示"}
          </button>
        </div>
      </div>

      {/* Base URL */}
      <div className="space-y-2">
        <Label className="text-xs">API Base URL</Label>
        <Input
          value={llmConfig.baseUrl}
          onChange={(e) => setLLMConfig({ baseUrl: e.target.value })}
          placeholder="https://api.openai.com/v1"
          className="text-xs"
        />
      </div>

      {/* Model */}
      <div className="space-y-2">
        <Label className="text-xs">模型</Label>
        <Input
          value={llmConfig.model}
          onChange={(e) => setLLMConfig({ model: e.target.value })}
          placeholder="deepseek-chat"
          className="text-xs"
        />
      </div>

      {/* Temperature */}
      <div className="space-y-2">
        <Label className="text-xs">Temperature: {llmConfig.temperature}</Label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={llmConfig.temperature}
          onChange={(e) => setLLMConfig({ temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={() => {
          toast.success("配置已保存到本地");
        }}
      >
        保存配置
      </Button>
    </div>
  );
}
