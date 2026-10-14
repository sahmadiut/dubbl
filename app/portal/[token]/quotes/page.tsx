"use client";

import { portalQuotesSchema, acceptedQuoteSchema } from "@/lib/money/public-ui";
import { clientJson } from "@/lib/api/client-response";

import { documentMoneyText as formatMoney } from "@/lib/documents/render-wire";

import { useState, useEffect, useCallback } from "react";
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

interface Quote {
  id: string;
  quoteNumber: string;
  issueDate: string;
  expiryDate: string;
  total: number;
  status: string;
  currencyCode: string;
}


export default function PortalQuotesPage() {
  const { token } = useParams<{ token: string }>();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);

  const loadQuotes = useCallback(async (active: () => boolean = () => true) => {
    if (active()) { setLoading(true); setError(null); setQuotes([]); }
    try {
      const data = portalQuotesSchema.parse(await clientJson(await fetch(`/api/v1/portal/${token}/quotes`), "Unable to load quotes"));
      if (active()) setQuotes(data.data);
    } catch { if (active()) setError("Unable to load quotes safely. Please try again or contact the sender."); }
    finally { if (active()) setLoading(false); }
  }, [token]);

  useEffect(() => {
    let active = true;
    void loadQuotes(() => active);
    return () => { active = false; };
  }, [loadQuotes]);

  const handleAccept = async (id: string) => {
    if (accepting) return;
    setAccepting(id); setError(null);
    try {
      acceptedQuoteSchema.parse(await clientJson(await fetch(`/api/v1/portal/${token}/quotes/${id}/accept`, { method: "POST" }), "Unable to accept quote"));
      await loadQuotes();
    } catch { setError("Unable to accept quote. Please reload and try again."); }
    finally { setAccepting(null); }
  };

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><p className="text-sm text-gray-500">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Quotes</h2>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && quotes.length === 0 ? null : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-gray-500 py-8">
                  No quotes found
                </TableCell>
              </TableRow>
            ) : (
              quotes.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="text-sm font-medium">{q.quoteNumber}</TableCell>
                  <TableCell className="text-sm">{q.issueDate}</TableCell>
                  <TableCell className="text-sm">{q.expiryDate}</TableCell>
                  <TableCell className="text-sm text-right">{formatMoney(q.total, q.currencyCode)}</TableCell>
                  <TableCell>
                    <Badge variant={q.status === "accepted" ? "default" : q.status === "declined" ? "destructive" : "secondary"} className="text-xs">
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {q.status === "sent" && (
                      <Button size="sm" variant="outline" disabled={!!accepting || !!error} onClick={() => handleAccept(q.id)}>
                        Accept
                      </Button>
                    )}
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
