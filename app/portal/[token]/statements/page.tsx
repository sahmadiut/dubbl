"use client";

import { portalStatementSchema } from "@/lib/money/public-ui";
import { clientJson, clientPdf, downloadBlob } from "@/lib/api/client-response";

import { documentMoneyText as formatMoney } from "@/lib/documents/render-wire";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface StatementLine {
  date: string;
  description: string;
  amount: number;
  paid: number;
  balance: number;
  runningBalance: number;
  status: string;
}


export default function PortalStatementsPage() {
  const { token } = useParams<{ token: string }>();
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(null); setLines([]); } });
    fetch(`/api/v1/portal/${token}/statements`)
      .then(r => clientJson(r, "Unable to load statement"))
      .then(value => {
        const data = portalStatementSchema.parse(value);
        if (active) { setLines(data.lines); setTotalOutstanding(data.totalOutstanding); setCurrencyCode(data.currencyCode); }
      })
      .catch(() => { if (active) setError("Unable to load statement safely. Please try again or contact the sender."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><p className="text-sm text-gray-500">Loading...</p></div>;
  }

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Statement of Account</h2>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" className="gap-1" onClick={async () => {
            try {
              const blob = await clientPdf(await fetch(`/api/portal/${token}/statements/pdf?format=pdf`));
              downloadBlob(blob, "statement.pdf");
            } catch { setError("Unable to download statement. Please try again."); }
          }}>
            <Download className="size-4" />Download statement (PDF)
          </Button>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Outstanding</p>
            <p className="text-xl font-bold">{formatMoney(totalOutstanding, currencyCode)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-gray-500 py-8">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{line.date}</TableCell>
                  <TableCell className="text-sm">{line.description}</TableCell>
                  <TableCell className="text-sm text-right">{formatMoney(line.amount, currencyCode)}</TableCell>
                  <TableCell className="text-sm text-right">{formatMoney(line.paid, currencyCode)}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{formatMoney(line.balance, currencyCode)}</TableCell>
                  <TableCell>
                    <Badge variant={line.status === "paid" ? "default" : "secondary"} className="text-xs">
                      {line.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
