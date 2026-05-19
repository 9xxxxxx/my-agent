"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { ReportEditor } from "@/components/report/ReportEditor";
import { ExportButton } from "@/components/report/ExportButton";
import { fetchReport, updateReport, type ReportDetail } from "@/lib/api";
import { toast } from "sonner";

export default function ReportEditPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    const loadReport = async () => {
      try {
        const data = await fetchReport(reportId);
        setReport(data);
        setTitle(data.title);
        setContent(data.content);
      } catch (error) {
        toast.error("加载报告失败");
        router.push("/reports");
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [reportId, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateReport(reportId, { title, content });
      toast.success("报告已保存");
    } catch (error) {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-4 px-4 py-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/reports")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 px-0"
          placeholder="报告标题"
        />

        <div className="flex items-center gap-2 ml-auto">
          <ExportButton reportId={reportId} reportTitle={title} />
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          <ReportEditor content={content} onChange={setContent} />
        </div>
      </main>
    </div>
  );
}
