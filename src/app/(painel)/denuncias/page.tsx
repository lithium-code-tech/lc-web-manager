"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { REPORT_REASONS, type ReportReason } from "@/lib/models";
import type { ReportCaseWithPreview } from "@/lib/server/reports";
import { RequireRole } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Modal,
  PageHeader,
  PageLoading,
  Textarea,
  formatDateTime,
  useToast,
} from "@/components/ui";

const FILTERS = [
  { key: "open", label: "Para analisar" },
  { key: "decided", label: "Já decididas" },
] as const;

const TARGET_LABEL = { challenge: "Desafio", response: "Resposta", skater: "Perfil" } as const;

type Decision = { entry: ReportCaseWithPreview; action: "keep" | "remove"; banOwner: boolean };

function Media({ entry }: { entry: ReportCaseWithPreview }) {
  const { preview } = entry;
  if (!preview.exists) return <div className="flex aspect-[9/16] items-center justify-center bg-surface-2 text-xs text-muted">Excluído</div>;
  if (preview.mediaType === "video" && preview.mediaUrl) {
    return <video src={preview.mediaUrl} poster={preview.coverUrl || undefined} controls preload="none" className="aspect-[9/16] w-full bg-black object-contain" />;
  }
  const image = preview.mediaUrl || preview.coverUrl;
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="aspect-[9/16] w-full bg-black object-contain" />
  ) : (
    <div className="flex aspect-[9/16] items-center justify-center bg-surface-2 text-xs text-muted">Sem mídia</div>
  );
}

function CaseCard({ entry, onDecide }: { entry: ReportCaseWithPreview; onDecide: (decision: Decision) => void }) {
  const reasons = Object.entries(entry.reasons) as [ReportReason, number][];
  const isProfile = entry.targetType === "skater";
  return (
    <Card className="grid gap-4 sm:grid-cols-[9rem_1fr]">
      <div className="overflow-hidden rounded-lg border border-line">
        <Media entry={entry} />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{TARGET_LABEL[entry.targetType]}</Badge>
          <span className="font-semibold">@{entry.preview.ownerNick || entry.targetOwnerId}</span>
          {entry.preview.hidden && <Badge tone="warn">Escondido</Badge>}
          {entry.preview.banned && <Badge tone="danger">Autor bloqueado</Badge>}
          {entry.decision && (
            <Badge tone={entry.decision.status === "kept" ? "ok" : "danger"}>
              {entry.decision.status === "kept" ? "Mantido" : "Removido"} por {entry.decision.decidedByName}
            </Badge>
          )}
        </div>
        <p className="text-sm">
          <strong>{entry.reporterCount}</strong> {entry.reporterCount === 1 ? "pessoa denunciou" : "pessoas denunciaram"}
          {entry.decision && entry.pendingCount > 0 && <> · {entry.pendingCount} depois da última decisão</>}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {reasons.map(([reason, count]) => (
            <Badge key={reason} tone={reason === "sexual" || reason === "violence" ? "danger" : "neutral"}>
              {REPORT_REASONS[reason] ?? reason} · {count}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted">
          Primeira {formatDateTime(entry.firstAt)} · última {formatDateTime(entry.lastAt)}
          {entry.decision?.note && <> · Nota: “{entry.decision.note}”</>}
        </p>
        {entry.preview.exists && (
          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => onDecide({ entry, action: "keep", banOwner: false })}>
              Manter no ar
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDecide({ entry, action: "remove", banOwner: false })}>
              {isProfile ? "Bloquear perfil" : "Remover"}
            </Button>
            {!isProfile && !entry.preview.banned && (
              <Button variant="danger" size="sm" onClick={() => onDecide({ entry, action: "remove", banOwner: true })}>
                Remover e bloquear autor
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function ReportsQueue() {
  const toast = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [reload, setReload] = useState(0);
  const requestKey = `${filter}:${reload}`;
  const [result, setResult] = useState<{ key: string; cases: ReportCaseWithPreview[] | null; error: string | null }>({
    key: "",
    cases: null,
    error: null,
  });
  const [pending, setPending] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ cases: ReportCaseWithPreview[] }>(`/api/reports?status=${requestKey.split(":")[0]}`).then(
      (response) => active && setResult({ key: requestKey, cases: response.cases, error: null }),
      (err) => active && setResult({ key: requestKey, cases: null, error: errorMessage(err) }),
    );
    return () => {
      active = false;
    };
  }, [requestKey]);

  const isCurrent = result.key === requestKey;
  const cases = isCurrent ? result.cases : null;
  const error = isCurrent ? result.error : null;
  const load = () => setReload((n) => n + 1);

  async function confirm() {
    if (!pending) return;
    setSaving(true);
    try {
      await api("/api/reports/decision", {
        method: "POST",
        body: {
          targetType: pending.entry.targetType,
          targetId: pending.entry.targetId,
          action: pending.action,
          banOwner: pending.banOwner,
          note,
        },
      });
      toast(pending.action === "keep" ? "Conteúdo mantido." : "Feito. O conteúdo saiu do app.");
      setPending(null);
      setNote("");
      load();
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  }

  const title = !pending
    ? ""
    : pending.action === "keep"
      ? "Manter no ar?"
      : pending.entry.targetType === "skater"
        ? "Bloquear este perfil?"
        : pending.banOwner
          ? "Remover e bloquear o autor?"
          : "Remover este conteúdo?";

  return (
    <>
      <PageHeader
        title="Denúncias"
        description="Conteúdo com 3 denúncias de pessoas diferentes já é escondido automaticamente. Aqui a equipe decide: manter, remover ou bloquear quem publicou."
        actions={FILTERS.map((item) => (
          <Button key={item.key} variant={filter === item.key ? "primary" : "secondary"} size="sm" onClick={() => setFilter(item.key)}>
            {item.label}
          </Button>
        ))}
      />
      <ErrorNote message={error} />
      {!cases && !error && <PageLoading />}
      {cases?.length === 0 && (
        <EmptyState title={filter === "open" ? "Nenhuma denúncia para analisar" : "Nenhuma decisão ainda"} description="Quando alguém denunciar pelo app, aparece aqui." />
      )}
      <div className="flex flex-col gap-4">
        {cases?.map((entry) => <CaseCard key={entry.key} entry={entry} onDecide={setPending} />)}
      </div>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button variant={pending?.action === "keep" ? "primary" : "danger"} loading={saving} onClick={confirm}>
              Confirmar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {pending?.action === "keep"
            ? "O conteúdo volta a aparecer no app (se estava escondido). Só denúncias novas reabrem o caso."
            : pending?.banOwner || pending?.entry.targetType === "skater"
              ? "A pessoa perde o acesso na hora, e tudo o que ela publicou é escondido. Dá para desbloquear depois em Skaters."
              : "O conteúdo some do app para todo mundo."}
        </p>
        <Textarea placeholder="Nota interna (opcional) — fica no histórico" value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </>
  );
}

export default function ReportsPage() {
  return (
    <RequireRole roles={["ADM"]}>
      <ReportsQueue />
    </RequireRole>
  );
}
