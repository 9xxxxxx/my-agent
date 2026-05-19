"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2 } from "lucide-react";
import type { Report } from "@/lib/api";

interface ReportCardProps {
  report: Report;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, format: "pdf" | "excel" | "csv") => void;
}

export function ReportCard({ report, onSelect, onDelete, onExport }: ReportCardProps) {
  const date = new Date(report.updated_at * 1000);
  const formattedDate = date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onSelect(report.id)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base line-clamp-1">{report.title}</CardTitle>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onExport(report.id, "pdf")}
              title="导出 PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => onDelete(report.id)}
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {report.summary || "暂无摘要"}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {report.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {report.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{report.tags.length - 3}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>
      </CardContent>
    </Card>
  );
}
