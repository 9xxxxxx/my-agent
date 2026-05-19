"use client";

import { useRouter } from "next/navigation";
import { ReportList } from "@/components/report/ReportList";
import { createReport } from "@/lib/api";
import { toast } from "sonner";

export default function ReportsPage() {
  const router = useRouter();

  const handleSelect = (id: string) => {
    router.push(`/reports/${id}`);
  };

  const handleCreate = async () => {
    try {
      const report = await createReport({
        title: "新报告",
        content: "<p>开始编写您的报告...</p>",
      });
      toast.success("报告已创建");
      router.push(`/reports/${report.id}`);
    } catch (error) {
      toast.error("创建报告失败");
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">报告管理</h1>
        <p className="text-[--muted-foreground] mt-1">
          创建、编辑和管理您的分析报告
        </p>
      </div>

      <ReportList onSelect={handleSelect} onCreate={handleCreate} />
    </div>
  );
}
