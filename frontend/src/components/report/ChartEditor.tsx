"use client";

import { useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChartTypeSelector, type ChartType } from "./ChartTypeSelector";
import { ColorSchemePicker, COLOR_SCHEMES, type ColorScheme } from "./ColorSchemePicker";

export interface ChartData {
  labels: string[];
  values: number[];
  title: string;
}

interface ChartEditorProps {
  data: ChartData;
  chartType?: ChartType;
  colorScheme?: string;
  onTypeChange?: (type: ChartType) => void;
  onColorSchemeChange?: (scheme: ColorScheme) => void;
  onTitleChange?: (title: string) => void;
  readOnly?: boolean;
}

export function ChartEditor({
  data,
  chartType: initialType = "bar",
  colorScheme: initialScheme = "默认",
  onTypeChange,
  onColorSchemeChange,
  onTitleChange,
  readOnly = false,
}: ChartEditorProps) {
  const [chartType, setChartType] = useState<ChartType>(initialType);
  const [selectedScheme, setSelectedScheme] = useState(initialScheme);
  const [title, setTitle] = useState(data.title);

  const scheme = useMemo(
    () => COLOR_SCHEMES.find((s) => s.name === selectedScheme) || COLOR_SCHEMES[0],
    [selectedScheme]
  );

  const handleTypeChange = (type: ChartType) => {
    setChartType(type);
    onTypeChange?.(type);
  };

  const handleSchemeChange = (newScheme: ColorScheme) => {
    setSelectedScheme(newScheme.name);
    onColorSchemeChange?.(newScheme);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    onTitleChange?.(newTitle);
  };

  const option = useMemo(() => {
    const base = {
      title: {
        text: title,
        left: "center",
      },
      tooltip: {
        trigger: chartType === "pie" || chartType === "funnel" || chartType === "treemap" ? "item" : "axis",
      },
      color: scheme.colors,
    };

    if (chartType === "pie") {
      return {
        ...base,
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            data: data.labels.map((label, i) => ({
              name: label,
              value: data.values[i] || 0,
            })),
            label: {
              show: true,
              formatter: "{b}: {c} ({d}%)",
            },
          },
        ],
      };
    }

    if (chartType === "radar") {
      const max = Math.max(...data.values) * 1.2;
      return {
        ...base,
        radar: {
          indicator: data.labels.map((name) => ({ name, max })),
        },
        series: [
          {
            type: "radar",
            data: [
              {
                value: data.values,
                name: title,
              },
            ],
          },
        ],
      };
    }

    if (chartType === "funnel") {
      return {
        ...base,
        series: [
          {
            type: "funnel",
            left: "10%",
            width: "80%",
            data: data.labels.map((label, i) => ({
              name: label,
              value: data.values[i] || 0,
            })),
          },
        ],
      };
    }

    if (chartType === "treemap") {
      return {
        ...base,
        series: [
          {
            type: "treemap",
            data: data.labels.map((label, i) => ({
              name: label,
              value: data.values[i] || 0,
            })),
          },
        ],
      };
    }

    if (chartType === "boxplot") {
      return {
        ...base,
        xAxis: {
          type: "category",
          data: data.labels,
          axisLabel: {
            rotate: data.labels.length > 10 ? 30 : 0,
          },
        },
        yAxis: {
          type: "value",
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true,
        },
        series: [
          {
            type: "boxplot",
            data: data.values,
          },
        ],
      };
    }

    if (chartType === "candlestick") {
      return {
        ...base,
        xAxis: {
          type: "category",
          data: data.labels,
          axisLabel: {
            rotate: data.labels.length > 10 ? 30 : 0,
          },
        },
        yAxis: {
          type: "value",
          scale: true,
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true,
        },
        series: [
          {
            type: "candlestick",
            data: data.values,
          },
        ],
      };
    }

    if (chartType === "waterfall") {
      const values = data.values;
      const baseData: number[] = [];
      const positiveData: (number | string)[] = [];
      const negativeData: (number | string)[] = [];
      let cumulative = 0;

      values.forEach((v) => {
        if (v >= 0) {
          baseData.push(cumulative);
          positiveData.push(v);
          negativeData.push("-");
          cumulative += v;
        } else {
          cumulative += v;
          baseData.push(cumulative);
          positiveData.push("-");
          negativeData.push(Math.abs(v));
        }
      });

      return {
        ...base,
        xAxis: {
          type: "category",
          data: data.labels,
          axisLabel: {
            rotate: data.labels.length > 10 ? 30 : 0,
          },
        },
        yAxis: {
          type: "value",
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true,
        },
        series: [
          {
            type: "bar",
            stack: "waterfall",
            data: baseData,
            itemStyle: { color: "transparent" },
            emphasis: { itemStyle: { color: "transparent" } },
          },
          {
            type: "bar",
            stack: "waterfall",
            data: positiveData,
            name: "增加",
            itemStyle: { color: "#059669" },
          },
          {
            type: "bar",
            stack: "waterfall",
            data: negativeData,
            name: "减少",
            itemStyle: { color: "#ef4444" },
          },
        ],
        legend: {
          data: ["增加", "减少"],
          bottom: 0,
        },
      };
    }

    if (chartType === "sankey") {
      const nodes = new Set<string>();
      const links: { source: string; target: string; value: number }[] = [];

      data.labels.forEach((label, i) => {
        if (i < data.labels.length - 1) {
          nodes.add(label);
          nodes.add(data.labels[i + 1]);
          links.push({
            source: label,
            target: data.labels[i + 1],
            value: data.values[i] || 0,
          });
        }
      });

      return {
        ...base,
        tooltip: { trigger: "item" },
        series: [
          {
            type: "sankey",
            data: Array.from(nodes).map((name) => ({ name })),
            links,
            emphasis: { focus: "adjacency" },
            lineStyle: { color: "gradient", curveness: 0.5 },
          },
        ],
      };
    }

    if (chartType === "horizontal_bar") {
      return {
        ...base,
        yAxis: {
          type: "category",
          data: data.labels,
        },
        xAxis: {
          type: "value",
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true,
        },
        series: [
          {
            type: "bar",
            data: data.values,
          },
        ],
      };
    }

    // bar, line, area, scatter, heatmap
    return {
      ...base,
      xAxis: {
        type: chartType === "scatter" ? "value" : "category",
        data: chartType === "scatter" ? undefined : data.labels,
        axisLabel: {
          rotate: data.labels.length > 10 ? 30 : 0,
        },
      },
      yAxis: {
        type: chartType === "scatter" ? "value" : "value",
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        containLabel: true,
      },
      series: [
        {
          type: chartType === "area" ? "line" : chartType,
          data:
            chartType === "scatter"
              ? data.labels.map((_, i) => [i, data.values[i] || 0])
              : data.values,
          ...(chartType === "area" ? { areaStyle: {} } : {}),
        },
      ],
    };
  }, [chartType, scheme, data, title]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">图表编辑</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <>
            <div className="space-y-2">
              <Label>图表标题</Label>
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="输入图表标题"
              />
            </div>

            <ChartTypeSelector value={chartType} onChange={handleTypeChange} />

            <ColorSchemePicker value={selectedScheme} onChange={handleSchemeChange} />
          </>
        )}

        <div className="border rounded-lg p-4">
          <ReactECharts
            option={option}
            style={{ height: "300px" }}
            opts={{ renderer: "svg" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
