"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { AuditEntry } from "@/lib/models";
import { RequireRole } from "@/components/shell";
import { Card, EmptyState, ErrorNote, PageHeader, PageLoading, formatDateTime } from "@/components/ui";

function Activity() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ entries: AuditEntry[] }>("/api/audit").then((r) => setEntries(r.entries), (err) => setError(errorMessage(err)));
  }, []);

  return (
    <>
      <PageHeader title="Atividade" description="Últimas 200 ações da equipe: moderação, bloqueios, pagamentos, campanhas e equipe." />
      <ErrorNote message={error} />
      {!entries && !error && <PageLoading />}
      {entries?.length === 0 && <EmptyState title="Nada registrado ainda" />}
      {entries && entries.length > 0 && (
        <Card className="divide-y divide-line p-0">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-sm">
              <span className="w-32 shrink-0 text-xs text-muted tabular-nums">{formatDateTime(entry.at)}</span>
              <span className="min-w-0 flex-1">
                <strong>{entry.actorName}</strong> {entry.summary}
              </span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

export default function ActivityPage() {
  return (
    <RequireRole roles={["ADM"]}>
      <Activity />
    </RequireRole>
  );
}
