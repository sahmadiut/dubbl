"use client";

import { useState, useEffect, type ReactNode } from "react";
import { AdminNavigation } from "@/components/admin/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isSiteAdmin, setIsSiteAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/v1/admin/check")
      .then((r) => r.json())
      .then((data) => setIsSiteAdmin(data.isSiteAdmin === true))
      .catch(() => setIsSiteAdmin(false));
  }, []);

  if (isSiteAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-foreground" />
      </div>
    );
  }

  return <AdminNavigation allowed={isSiteAdmin}>{children}</AdminNavigation>;
}
