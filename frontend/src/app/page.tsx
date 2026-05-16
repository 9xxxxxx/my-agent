"use client";

import { useState } from "react";
import ChatPanel from "@/components/chat/ChatPanel";
import ModelConfig from "@/components/settings/ModelConfig";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const llmConfig = useChatStore((s) => s.llmConfig);

  return (
    <div className="flex h-screen">
      {/* 侧边栏 */}
      <aside
        className={`${
          sidebarOpen ? "w-[260px]" : "w-0"
        } transition-all duration-200 ease-out flex flex-col bg-[#f4f3f1] border-r border-[#e5e4e1] overflow-hidden`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#2d2d2d] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <span className="text-[13px] font-medium tracking-tight text-[#2d2d2d]">Data Analyst</span>
          </div>
        </div>

        {/* 新建对话 */}
        <div className="px-3 pb-2">
          <button
            onClick={clearMessages}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#5a5a52] hover:bg-[#eae9e6] transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            新对话
          </button>
        </div>

        <div className="mx-3 h-px bg-[#e5e4e1]" />

        {/* 对话历史占位 */}
        <div className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="text-[11px] text-[#9a9a92] px-3 py-1.5 uppercase tracking-wider font-medium">今天</div>
          {/* 历史记录会在这里 */}
        </div>

        <div className="mx-3 h-px bg-[#e5e4e1]" />

        {/* 底部配置 */}
        <div className="p-3 shrink-0">
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#5a5a52] hover:bg-[#eae9e6] transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            模型设置
            <span className="ml-auto text-[11px] text-[#9a9a92]">{llmConfig.model}</span>
          </button>
        </div>
      </aside>

      {/* 配置面板 */}
      {configOpen && (
        <div className="w-[300px] border-r border-[#e5e4e1] bg-white overflow-y-auto">
          <div className="h-14 flex items-center justify-between px-5 border-b border-[#e5e4e1]">
            <span className="text-[13px] font-medium text-[#2d2d2d]">模型配置</span>
            <button onClick={() => setConfigOpen(false)} className="text-[#9a9a92] hover:text-[#2d2d2d]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <ModelConfig />
        </div>
      )}

      {/* 主区域 */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f9f9f7]">
        {/* 顶栏 */}
        <header className="h-14 flex items-center px-4 shrink-0 border-b border-[#e5e4e1]/60 bg-[#f9f9f7]/80 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-[#eae9e6] text-[#7a7a72] mr-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          <span className="text-[13px] text-[#9a9a92]">与 AI 分析师对话</span>
        </header>

        <ChatPanel />
      </main>
    </div>
  );
}
