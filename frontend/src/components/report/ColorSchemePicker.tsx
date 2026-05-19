"use client";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export interface ColorScheme {
  name: string;
  colors: string[];
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    name: "默认",
    colors: ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"],
  },
  {
    name: "商务蓝",
    colors: ["#1a73e8", "#4285f4", "#669df6", "#8ab4f8", "#aecbfa", "#c6dafc", "#d2e3fc", "#e8f0fe", "#f1f3f4"],
  },
  {
    name: "科技感",
    colors: ["#00d4ff", "#00b4d8", "#0096c7", "#0077b6", "#023e8a", "#03045e", "#001845", "#001233", "#00040a"],
  },
  {
    name: "自然绿",
    colors: ["#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2", "#b7e4c7", "#d8f3dc", "#e8f5e9", "#f1f8e9"],
  },
  {
    name: "暖色调",
    colors: ["#e63946", "#f4845f", "#f7b267", "#f7d08a", "#f8e16c", "#ffd166", "#06d6a0", "#118ab2", "#073b4c"],
  },
  {
    name: "冷色调",
    colors: ["#03045e", "#023e8a", "#0077b6", "#0096c7", "#00b4d8", "#48cae4", "#90e0ef", "#ade8f4", "#caf0f8"],
  },
];

interface ColorSchemePickerProps {
  value: string;
  onChange: (scheme: ColorScheme) => void;
}

export function ColorSchemePicker({ value, onChange }: ColorSchemePickerProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">配色方案</div>
      <div className="grid grid-cols-2 gap-2">
        {COLOR_SCHEMES.map((scheme) => (
          <Button
            key={scheme.name}
            variant={value === scheme.name ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(scheme)}
            className="flex items-center gap-2 justify-start"
          >
            <div className="flex gap-0.5">
              {scheme.colors.slice(0, 5).map((color, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <span className="truncate">{scheme.name}</span>
            {value === scheme.name && <Check className="h-3 w-3 ml-auto" />}
          </Button>
        ))}
      </div>
    </div>
  );
}
