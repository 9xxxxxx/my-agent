"use client";

import { Button } from "@/components/ui/button";
import {
  BarChart3,
  LineChart,
  PieChart,
  ScatterChart,
  AreaChart,
  Radar,
  Grid3X3,
  Box,
  CandlestickChart,
  Filter,
  LayoutGrid,
  ArrowRightLeft,
  TrendingDown,
  Workflow,
} from "lucide-react";

export type ChartType =
  | "bar"
  | "line"
  | "pie"
  | "scatter"
  | "area"
  | "radar"
  | "heatmap"
  | "boxplot"
  | "candlestick"
  | "funnel"
  | "sankey"
  | "horizontal_bar"
  | "treemap"
  | "waterfall";

const CHART_TYPES: { type: ChartType; label: string; icon: React.ReactNode }[] = [
  { type: "bar", label: "柱状图", icon: <BarChart3 className="h-4 w-4" /> },
  { type: "line", label: "折线图", icon: <LineChart className="h-4 w-4" /> },
  { type: "pie", label: "饼图", icon: <PieChart className="h-4 w-4" /> },
  { type: "scatter", label: "散点图", icon: <ScatterChart className="h-4 w-4" /> },
  { type: "area", label: "面积图", icon: <AreaChart className="h-4 w-4" /> },
  { type: "radar", label: "雷达图", icon: <Radar className="h-4 w-4" /> },
  { type: "heatmap", label: "热力图", icon: <Grid3X3 className="h-4 w-4" /> },
  { type: "boxplot", label: "箱线图", icon: <Box className="h-4 w-4" /> },
  { type: "candlestick", label: "K线图", icon: <CandlestickChart className="h-4 w-4" /> },
  { type: "funnel", label: "漏斗图", icon: <Filter className="h-4 w-4" /> },
  { type: "sankey", label: "桑基图", icon: <Workflow className="h-4 w-4" /> },
  { type: "horizontal_bar", label: "水平柱状图", icon: <ArrowRightLeft className="h-4 w-4" /> },
  { type: "treemap", label: "矩形树图", icon: <LayoutGrid className="h-4 w-4" /> },
  { type: "waterfall", label: "瀑布图", icon: <TrendingDown className="h-4 w-4" /> },
];

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHART_TYPES.map(({ type, label, icon }) => (
        <Button
          key={type}
          variant={value === type ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(type)}
          className="flex items-center gap-2"
        >
          {icon}
          {label}
        </Button>
      ))}
    </div>
  );
}
