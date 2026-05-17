"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";

// ─── Multiple color palettes ───
const PALETTES = {
  default: {
    name: "经典",
    colors: ["#2563eb", "#059669", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"],
  },
  warm: {
    name: "暖色",
    colors: ["#ea580c", "#d97706", "#ca8a04", "#65a30d", "#0d9488", "#0891b2", "#7c3aed", "#c026d3", "#e11d48", "#9f1239"],
  },
  cool: {
    name: "冷色",
    colors: ["#0284c7", "#0369a1", "#0e7490", "#047857", "#15803d", "#4338ca", "#6d28d9", "#7e22ce", "#a21caf", "#be123c"],
  },
  pastel: {
    name: "柔和",
    colors: ["#93c5fd", "#86efac", "#fde68a", "#fca5a5", "#c4b5fd", "#67e8f9", "#f9a8d4", "#5eead4", "#fdba74", "#a5b4fc"],
  },
  monochrome: {
    name: "单色",
    colors: ["#1e3a5f", "#1e40af", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#1d4ed8", "#7c3aed", "#6366f1"],
  },
} as const;

type PaletteKey = keyof typeof PALETTES;

// Register themes for each palette
const THEME_BASE = {
  backgroundColor: "transparent",
  textStyle: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    color: "#64748b",
  },
  title: {
    textStyle: {
      color: "#0f172a",
      fontWeight: 600,
      fontSize: 14,
    },
  },
  tooltip: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    textStyle: {
      color: "#0f172a",
      fontSize: 13,
    },
    extraCssText: "box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 10px;",
  },
  legend: {
    textStyle: {
      color: "#64748b",
      fontSize: 12,
    },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: "#e2e8f0" } },
    axisTick: { lineStyle: { color: "#e2e8f0" } },
    axisLabel: { color: "#64748b", fontSize: 11 },
    splitLine: { lineStyle: { color: "#f1f5f9" } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#64748b", fontSize: 11 },
    splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
  },
};

Object.entries(PALETTES).forEach(([key, palette]) => {
  echarts.registerTheme(`dataAnalyst_${key}`, {
    ...THEME_BASE,
    color: palette.colors,
  });
});

interface EChartProps {
  option: echarts.EChartsOption;
  height?: number;
  palette?: PaletteKey;
}

export default function EChart({ option, height, palette: paletteProp }: EChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const [currentPalette, setCurrentPalette] = useState<PaletteKey>(paletteProp || "default");

  useEffect(() => {
    if (!chartRef.current) return;

    if (instanceRef.current) {
      instanceRef.current.dispose();
      instanceRef.current = null;
    }

    instanceRef.current = echarts.init(chartRef.current, `dataAnalyst_${currentPalette}`, {
      renderer: "canvas",
    });

    instanceRef.current.setOption(option as echarts.EChartsOption, { notMerge: true });

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [option, currentPalette]);

  const chartHeight = height ?? undefined;

  return (
    <div className="relative group/chart">
      {/* Palette selector — appears on hover */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/chart:opacity-100 transition-opacity duration-200">
        <select
          value={currentPalette}
          onChange={(e) => setCurrentPalette(e.target.value as PaletteKey)}
          className="text-[11px] px-2 py-1 rounded-md bg-white/90 backdrop-blur-sm border border-[--border] text-[--muted-foreground] shadow-sm cursor-pointer focus:outline-none focus:border-[--primary]/40"
        >
          {Object.entries(PALETTES).map(([key, p]) => (
            <option key={key} value={key}>{p.name}</option>
          ))}
        </select>
      </div>
      <div
        ref={chartRef}
        role="img"
        aria-label="数据图表"
        style={{ width: "100%", height: chartHeight }}
        className={`rounded-xl ${chartHeight ? "" : "h-[300px] sm:h-[360px] lg:h-[400px]"}`}
      />
    </div>
  );
}
