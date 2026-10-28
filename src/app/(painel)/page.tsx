"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useStaff } from "@/components/auth-provider";
import { Card, ErrorNote, PageHeader, PageLoading } from "@/components/ui";

type Stats = {
  skaters: number;
  challenges: number;
  banned: number;
  publishedAds: number;
  awaitingPayment: number;
  openReports: number | null;
};

function Metric({ label, value, href, highlight }: { label: string; value: number; href?: string; highlight?: boolean }) {
  const body = (
    <Card className={highlight ? "border-brand/60" : "transition hover:border-muted"}>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${highlight ? "text-brand" : ""}`}>{value.toLocaleString("pt-BR")}</p>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function OverviewPage() {
  const { staff, can } = useStaff();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>("/api/stats").then(setStats, (err) => setError(errorMessage(err)));
  }, []);

  return (
    <>
      <PageHeader title={`Olá, ${staff.name.split(" ")[0] || "equipe"}`} description="Resumo do SkateGo agora." />
      <ErrorNote message={error} />
      {!stats && !error && <PageLoading />}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.openReports !== null && (
            <Metric label="Denúncias para analisar" value={stats.openReports} href="/denuncias" highlight={stats.openReports > 0} />
          )}
          <Metric label="Skaters cadastrados" value={stats.skaters} href={can("ADM") ? "/skaters" : undefined} />
          <Metric label="Desafios criados" value={stats.challenges} />
          {can("ADM") && <Metric label="Contas bloqueadas" value={stats.banned} href="/skaters?filtro=bloqueados" />}
          <Metric label="Anúncios no ar ou agendados" value={stats.publishedAds} href="/anuncios" />
          <Metric
            label="Campanhas aguardando pagamento"
            value={stats.awaitingPayment}
            href="/anuncios?status=awaiting_payment"
            highlight={stats.awaitingPayment > 0}
          />
        </div>
      )}
    </>
  );
}
