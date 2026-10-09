"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateCSV } from "@/lib/import-export/csv-utils";

interface ExportButtonProps {
  data: object[];
  columns: string[];
  filename?: string;
}

export function ExportButton({ data, columns, filename = "export" }: ExportButtonProps) {
  const handleExport = () => {
    if (data.length === 0) return;

    const csv = generateCSV(data.map(row => Object.fromEntries(Object.entries(row))), columns);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={data.length === 0}
    >
      <Download className="mr-1.5 size-3.5" />
      Export CSV
    </Button>
  );
}
