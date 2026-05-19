"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Loader2 } from "lucide-react";
import { ReportCard } from "./ReportCard";
import { fetchReports, deleteReport, getReportExportUrl, type Report } from "@/lib/api";
import { toast } from "sonner";

interface ReportListProps {
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ReportList({ onSelect, onCreate }: ReportListProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fetchReports(page, pageSize, search || undefined);
      setReports(data.items);
      setTotal(data.total);
    } catch {
      toast.error("加载报告列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [page, search]);

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个报告吗？")) return;
    try {
      await deleteReport(id);
      toast.success("报告已删除");
      loadReports();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleExport = (id: string, format: "pdf" | "excel" | "csv") => {
    const url = getReportExportUrl(id, format);
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索报告..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新建报告
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "没有找到匹配的报告" : "暂无报告"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onSelect={onSelect}
              onDelete={handleDelete}
              onExport={handleExport}
            />
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="flex items-center px-3 text-sm">
            {page} / {Math.ceil(total / pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
