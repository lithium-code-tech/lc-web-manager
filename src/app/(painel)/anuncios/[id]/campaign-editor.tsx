"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { api, errorMessage } from "@/lib/api";
import {
  CAMPAIGN_STATUS_LABELS,
  campaignStatus,
  cannotGoLiveReason,
  formatCents,
  normalizeCampaign,
} from "@/lib/domain/campaign";
import type { Campaign } from "@/lib/models";
import { useStaff } from "@/components/auth-provider";
import { RequireRole } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoading,
  formatDateTime,
  useToast,
} from "@/components/ui";
import { CampaignForm, valuesFrom } from "../campaign-form";
import { STATUS_TONES } from "../status";

function LiveCard({ campaign }: { campaign: Campaign }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const status = campaignStatus(campaign);
  const blocked = cannotGoLiveReason(campaign);

  async function toggle(live: boolean) {
    setBusy(true);
    try {
      await api(`/api/campaigns/${campaign.id}/live`, { method: "POST", body: { live } });
      const scheduled = campaignStatus({ ...campaign, live }) === "scheduled";
      toast(live ? (scheduled ? "Ligada. Entra no ar na data de início." : "No ar!") : "Desligada. Saiu do app.");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Veiculação</h2>
        <Badge tone={STATUS_TONES[status]}>{CAMPAIGN_STATUS_LABELS[status]}</Badge>
      </div>
      {campaign.live ? (
        <>
          <p className="text-sm text-muted">
            {status === "scheduled" ? "Ligada — aparece no app a partir do início do período." : status === "ended" ? "O período acabou; já não aparece no app." : "Aparecendo no app agora."}
          </p>
          <Button variant="danger" loading={busy} onClick={() => toggle(false)}>
            Desligar
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">{blocked ?? "Pronta. Ao ligar, aparece no app dentro do período."}</p>
          <Button loading={busy} disabled={blocked !== null} onClick={() => toggle(true)}>
            Ligar no app
          </Button>
        </>
      )}
    </Card>
  );
}

function PaymentCard({ campaign }: { campaign: Campaign }) {
  const { can } = useStaff();
  const toast = useToast();
  const [open, setOpen] = useState<"paid" | "pending" | null>(null);
  const [method, setMethod] = useState("Pix");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const paid = campaign.payment.status === "paid";

  async function save() {
    if (!open) return;
    setBusy(true);
    try {
      await api(`/api/campaigns/${campaign.id}/payment`, { method: "POST", body: { status: open, method, note } });
      toast(open === "paid" ? "Pagamento confirmado." : "Marcada como não paga.");
      setOpen(null);
      setNote("");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Pagamento</h2>
        <Badge tone={paid ? "ok" : "warn"}>{paid ? "Pago" : "Pendente"}</Badge>
      </div>
      <p className="text-2xl font-bold tabular-nums">{formatCents(campaign.priceCents)}</p>
      {paid ? (
        <p className="text-sm text-muted">
          {campaign.payment.method && <>{campaign.payment.method} · </>}confirmado por {campaign.payment.markedBy} em{" "}
          {formatDateTime(campaign.payment.paidAt)}
          {campaign.payment.note && <> · “{campaign.payment.note}”</>}
        </p>
      ) : (
        <p className="text-sm text-muted">Enquanto não estiver pago, não dá para ligar no app.</p>
      )}
      {can("ADM") ? (
        paid ? (
          <Button variant="ghost" size="sm" onClick={() => setOpen("pending")}>
            Desfazer pagamento
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setOpen("paid")}>
            Confirmar pagamento
          </Button>
        )
      ) : (
        !paid && <p className="text-xs text-muted">Um administrador confirma o pagamento.</p>
      )}

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open === "paid" ? "Confirmar pagamento" : "Desfazer pagamento?"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancelar
            </Button>
            <Button variant={open === "paid" ? "primary" : "danger"} loading={busy} onClick={save}>
              Confirmar
            </Button>
          </>
        }
      >
        {open === "paid" ? (
          <>
            <p className="text-sm text-muted">Confirme só depois de ver o dinheiro na conta. Fica registrado quem confirmou.</p>
            <Field label="Forma de pagamento">
              <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Pix, boleto, transferência…" />
            </Field>
          </>
        ) : (
          <p className="text-sm text-muted">Se a campanha estiver no ar, ela sai do app na hora.</p>
        )}
        <Field label="Observação (opcional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nº do comprovante, NF…" />
        </Field>
      </Modal>
    </Card>
  );
}

function Editor({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useStaff();
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "Campaign", id),
        (snapshot) => setCampaign(snapshot.exists() ? normalizeCampaign(snapshot.id, snapshot.data()) : null),
        () => setCampaign(null),
      ),
    [id],
  );

  if (campaign === undefined) return <PageLoading />;
  if (campaign === null) return <EmptyState title="Campanha não encontrada" />;

  async function remove() {
    setDeleting(true);
    try {
      await api(`/api/campaigns/${id}`, { method: "DELETE" });
      toast("Campanha excluída.");
      router.replace("/anuncios");
    } catch (err) {
      toast(errorMessage(err), "danger");
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={campaign.name || "Campanha"}
        description={`Criada por ${campaign.createdByName || "—"} em ${formatDateTime(campaign.createdAt)}`}
        actions={
          <>
            <Link href="/anuncios">
              <Button variant="ghost">Voltar</Button>
            </Link>
            {can("ADM") && (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={campaign.live}>
                Excluir
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <PaymentCard campaign={campaign} />
        <LiveCard campaign={campaign} />
      </div>
      <CampaignForm
        key={campaign.id}
        initial={valuesFrom(campaign)}
        submitLabel="Salvar alterações"
        lockedPaidFields={campaign.payment.status === "paid" && !can("ADM")}
        onSubmit={async (values) => {
          const { published } = await api<{ published: boolean }>(`/api/campaigns/${id}`, { method: "PATCH", body: values });
          toast(published ? "Salvo e atualizado no app." : "Salvo.");
        }}
      />
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir campanha?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} onClick={remove}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">A campanha e o histórico de pagamento somem do painel. O registro de atividade continua.</p>
      </Modal>
    </>
  );
}

export function CampaignEditor({ id }: { id: Promise<string> }) {
  const campaignId = use(id);
  return (
    <RequireRole roles={["ADM", "MKT"]}>
      <Editor id={campaignId} />
    </RequireRole>
  );
}
