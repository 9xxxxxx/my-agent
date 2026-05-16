"use client";

import { useState } from "react";
import ChatPanel from "@/components/chat/ChatPanel";
import ModelConfig from "@/components/settings/ModelConfig";
import LLMProvider from "@/components/settings/LLMProvider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useChatStore } from "@/stores/chat";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const clearMessages = useChatStore((s) => s.clearMessages);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 侧边栏 */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-300 border-r border-border bg-card flex flex-col overflow-hidden`}
      >
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <span className="text-lg"> </span>
            Data Analyst Agent
          </h1>
        </div>

        <Separator />

        {/* LLM 状态 */}
        <LLMProvider />

        <Separator />

        {/* 模型配置 */}
        <div className="flex-1 overflow-y-auto">
          <ModelConfig />
        </div>

        <Separator />

        {/* 操作按钮 */}
        <div className="p-4 space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={clearMessages}
          >
            清空对话
          </Button>
        </div>
      </aside>

      {/* 主区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 */}
        <header className="h-12 flex items-center px-4 border-b border-border bg-card/50 backdrop-blur">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </Button>
          <span className="text-sm text-muted-foreground">与 AI 分析师对话</span>
        </header>

        {/* 对话区域 */}
        <ChatPanel />
      </main>
    </div>
  );
}
