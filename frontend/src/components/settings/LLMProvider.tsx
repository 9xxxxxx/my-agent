"use client";

import { useChatStore } from "@/stores/chat";
import { Badge } from "@/components/ui/badge";

export default function LLMProvider() {
  const llmConfig = useChatStore((s) => s.llmConfig);

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="text-[10px]">
        {llmConfig.provider}
      </Badge>
      <span className="truncate">{llmConfig.model}</span>
    </div>
  );
}
