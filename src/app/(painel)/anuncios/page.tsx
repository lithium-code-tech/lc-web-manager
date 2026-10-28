"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useLiveQuery } from "@/lib/hooks";
import { CAMPAIGN_STATUS_LABELS, campaignStatus, formatCents, normalizeCampaign, type CampaignStatus } from "@/lib/domain/campaign";
import { RequireRole } from "@/components/shell";
import { Badge, Button, Card, EmptyState, ErrorNote, PageHeader, PageLoading, formatDate } from "@/components/ui";
import { STATUS_TONES } from "./status";

const FILTER_ORDER: (CampaignStatus | "all")[] = ["all", "live", "scheduled", "ready", "awaiting_payment", "draft", "ended"];

function CampaignList() {
  const params = useSearchParams();
  const [filter, setFilter] = useState<CampaignStatus | "all">((params.get("status") as CampaignStatus) ?? "all");
  const q = useMemo(() => collection(db, "Campaign"), []);
  const { data, loading, error } = useLiveQuery(q, "campaigns", normalizeCampaign);

  const rows = data
    .map((campaign) => ({ campaign, status: campaignStatus(campaign) }))
    .sort((a, b) => FILTER_ORDER.indexOf(a.status) - FILTER_ORDER.indexOf(b.status) || b.campaign.createdAt.localeCompare(a.campaign.createdAt));
  const counts = rows.reduce<Partial<Record<CampaignStatus, number>>>((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {});
  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  return (
    <>
      <PageHeader
        title="Campanhas"
        description="Cada campanha é uma arte de um cliente, em uma ou mais posições do app. Só vai ao ar depois de paga e ligada."
        actions={
          <Link href="/anuncios/nova">
            <Button>Nova campanha</Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTER_ORDER.map((key) => (
          <Button key={key} size="sm" variant={filter === key ? "primary" : "secondary"} onClick={() => setFilter(key)}>
            {key === "all" ? "Todas" : CAMPAIGN_STATUS_LABELS[key]}
            {key !== "all" && counts[key] ? ` · ${counts[key]}` : ""}
          </Button>
        ))}
      </div>
      <ErrorNote message={error} />
      {loading && <PageLoading />}
      {!loading && visible.length === 0 && <EmptyState title="Nenhuma campanha aqui" />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map(({ campaign, status }) => (
          <Link key={campaign.id} href={`/anuncios/${campaign.id}`}>
            <Card className="flex h-full flex-col gap-3 p-0 transition hover:border-muted">
              <div className="aspect-[6/1] overflow-hidden rounded-t-xl bg-surface-2">
                {campaign.mediaUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={campaign.mediaUrl} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{campaign.name || "Sem nome"}</p>
                  <Badge tone={STATUS_TONES[status]}>{CAMPAIGN_STATUS_LABELS[status]}</Badge>
                </div>
                <p className="text-sm text-muted">{campaign.client.nomeFantasia || campaign.client.razaoSocial || "Sem cliente"}</p>
                <p className="mt-auto text-xs text-muted">
                  {formatDate(campaign.startDate)} a {formatDate(campaign.endDate)} · {formatCents(campaign.priceCents)}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function CampaignsPage() {
  return (
    <RequireRole roles={["ADM", "MKT"]}>
      <Suspense fallback={<PageLoading />}>
        <CampaignList />
      </Suspense>
    </RequireRole>
  );
}
