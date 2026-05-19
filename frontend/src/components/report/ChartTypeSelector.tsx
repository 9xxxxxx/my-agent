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
} from "lucide-react";

export type ChartType =
  | "bar"
  | "line"
  | "pie"
  | "scatter"
  | "area"
  | "radar"
  | "heatmap";

const CHART_TYPES: { type: ChartType; label: string; icon: React.ReactNode }[] = [
  { type: "bar", label: "柱状图", icon: <BarChart3 className="h-4 w-4" /> },
  { type: "line", label: "折线图", icon: <LineChart className="h-4 w-4" /> },
  { type: "pie", label: "饼图", icon: <PieChart className="h-4 w-4" /> },
  { type: "scatter", label: "散点图", icon: <ScatterChart className="h-4 w-4" /> },
  { type: "area", label: "面积图", icon: <AreaChart className="h-4 w-4" /> },
  { type: "radar", label: "雷达图", icon: <Radar className="h-4 w-4" /> },
  { type: "heatmap", label: "热力图", icon: <Grid3X3 className="h-4 w-4" /> },
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
