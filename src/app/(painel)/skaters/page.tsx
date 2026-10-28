"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { api, errorMessage } from "@/lib/api";
import { useLiveQuery } from "@/lib/hooks";
import type { Skater } from "@/lib/models";
import { RequireRole } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Input,
  Modal,
  PageHeader,
  PageLoading,
  Textarea,
  formatDate,
  formatDateTime,
  useToast,
} from "@/components/ui";

type Details = {
  account: { email: string; phoneNumber: string; birthDate: string; acceptedTermsAt: string };
  login: { email: string; disabled: boolean; createdAt: string; lastSignInAt: string } | null;
  challengesCreated: number;
  reportsAgainst: number;
  deletionPending: boolean;
};

function age(birthDate: string) {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
}

function Avatar({ url, name }: { url: string; name: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="size-10 shrink-0 rounded-full bg-surface-2 object-cover" />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-muted">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function SkaterPanel({ skater, onClose }: { skater: Skater; onClose: () => void }) {
  const toast = useToast();
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"ban" | "unban" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Details>(`/api/skaters/${skater.skaterId}`).then(setDetails, (err) => setError(errorMessage(err)));
  }, [skater.skaterId, skater.banned]);

  async function run() {
    setSaving(true);
    try {
      if (action === "ban") {
        const result = await api<{ hiddenItems: number }>(`/api/skaters/${skater.skaterId}/ban`, { method: "POST", body: { reason } });
        toast(`Conta bloqueada. ${result.hiddenItems} publicação(ões) escondida(s).`);
      } else if (action === "unban") {
        const result = await api<{ restoredItems: number }>(`/api/skaters/${skater.skaterId}/ban`, { method: "DELETE" });
        toast(`Conta desbloqueada. ${result.restoredItems} publicação(ões) de volta.`);
      } else if (action === "delete") {
        await api(`/api/skaters/${skater.skaterId}`, { method: "DELETE" });
        toast("Exclusão pedida. O acesso já foi cortado e os dados somem em até 1 hora.");
        onClose();
      }
      setAction(null);
      setReason("");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  }

  const years = details ? age(details.account.birthDate) : null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar url={skater.imageUrl} name={skater.nickName} />
          <div>
            <p className="font-semibold">@{skater.nickName}</p>
            <p className="text-sm text-muted">{skater.name}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <ErrorNote message={error} />
      {!details && !error && <PageLoading />}
      {details && (
        <>
          <div className="flex flex-wrap gap-2">
            {skater.banned && <Badge tone="danger">Bloqueado</Badge>}
            {details.deletionPending && <Badge tone="warn">Exclusão em andamento</Badge>}
            {years !== null && years < 18 && <Badge tone="danger">Menor de idade ({years})</Badge>}
            {details.reportsAgainst > 0 && <Badge tone="warn">{details.reportsAgainst} denúncia(s)</Badge>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">E-mail</dt>
            <dd className="break-all">{details.account.email || "—"}</dd>
            <dt className="text-muted">Celular</dt>
            <dd>{details.account.phoneNumber || "—"}</dd>
            <dt className="text-muted">Nascimento</dt>
            <dd>{details.account.birthDate ? `${formatDate(details.account.birthDate)} (${years} anos)` : "Não informado (conta antiga)"}</dd>
            <dt className="text-muted">Cadastro</dt>
            <dd>{formatDateTime(details.login?.createdAt ? new Date(details.login.createdAt).toISOString() : "")}</dd>
            <dt className="text-muted">Último acesso</dt>
            <dd>{formatDateTime(details.login?.lastSignInAt ? new Date(details.login.lastSignInAt).toISOString() : "")}</dd>
            <dt className="text-muted">Desafios</dt>
            <dd>{details.challengesCreated}</dd>
            <dt className="text-muted">Seguidores</dt>
            <dd>{skater.followers?.length ?? 0}</dd>
            {skater.banned && (
              <>
                <dt className="text-muted">Bloqueio</dt>
                <dd>
                  {formatDateTime(skater.bannedAt ?? "")} — {skater.bannedReason}
                </dd>
              </>
            )}
          </dl>
          {!details.deletionPending && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {skater.banned ? (
                <Button variant="secondary" onClick={() => setAction("unban")}>
                  Desbloquear
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setAction("ban")}>
                  Bloquear conta
                </Button>
              )}
              <Button variant="ghost" onClick={() => setAction("delete")}>
                Excluir conta
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={action !== null}
        onClose={() => setAction(null)}
        title={action === "ban" ? "Bloquear conta" : action === "unban" ? "Desbloquear conta" : "Excluir conta"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button
              variant={action === "unban" ? "primary" : "danger"}
              loading={saving}
              disabled={action === "ban" && reason.trim().length < 3}
              onClick={run}
            >
              Confirmar
            </Button>
          </>
        }
      >
        {action === "ban" && (
          <>
            <p className="text-sm text-muted">
              @{skater.nickName} perde o acesso na hora e tudo o que publicou é escondido. Dá para desbloquear depois.
            </p>
            <Textarea placeholder="Motivo (fica no histórico)" value={reason} onChange={(e) => setReason(e.target.value)} />
          </>
        )}
        {action === "unban" && (
          <p className="text-sm text-muted">O acesso volta e as publicações escondidas pelo bloqueio reaparecem.</p>
        )}
        {action === "delete" && (
          <p className="text-sm text-muted">
            Apaga de vez perfil, desafios, respostas, votos e mídia de @{skater.nickName}, em até 1 hora. Use para pedidos de
            exclusão e contas de menores de idade. <strong className="text-danger">Não dá para desfazer.</strong>
          </p>
        )}
      </Modal>
    </Card>
  );
}

function SkatersList() {
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [onlyBanned, setOnlyBanned] = useState(params.get("filtro") === "bloqueados");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const term = search.trim();

  const q = useMemo(() => {
    const skaters = collection(db, "Skater");
    if (onlyBanned) return query(skaters, where("banned", "==", true), limit(100));
    if (term) return query(skaters, orderBy("nickName"), where("nickName", ">=", term), where("nickName", "<=", `${term}`), limit(50));
    return query(skaters, orderBy("nickName"), limit(50));
  }, [onlyBanned, term]);

  const { data, loading, error } = useLiveQuery(q, `${onlyBanned}:${term}`, (id, d) => ({ ...(d as Skater), skaterId: id }));
  const selected = data.find((skater) => skater.skaterId === selectedId) ?? null;

  return (
    <>
      <PageHeader title="Skaters" description="Contas do app. Os dados de contato só aparecem para administradores." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Buscar por nickname (diferencia maiúsculas)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOnlyBanned(false);
          }}
        />
        <Button variant={onlyBanned ? "primary" : "secondary"} onClick={() => setOnlyBanned((value) => !value)}>
          Só bloqueados
        </Button>
      </div>
      <ErrorNote message={error} />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-2">
          {loading && <PageLoading />}
          {!loading && data.length === 0 && <EmptyState title="Ninguém encontrado" />}
          {data.map((skater) => (
            <button
              key={skater.skaterId}
              onClick={() => setSelectedId(skater.skaterId)}
              aria-pressed={selectedId === skater.skaterId}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-muted aria-pressed:border-brand"
            >
              <Avatar url={skater.imageUrl} name={skater.nickName ?? "?"} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">@{skater.nickName}</p>
                <p className="truncate text-sm text-muted">{skater.name}</p>
              </div>
              {skater.banned && <Badge tone="danger">Bloqueado</Badge>}
              <span className="hidden text-xs text-muted sm:inline">{skater.trophies?.length ?? 0} troféus</span>
            </button>
          ))}
        </div>
        <div className="lg:sticky lg:top-6">
          {selected ? (
            <SkaterPanel key={selected.skaterId} skater={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <EmptyState title="Selecione um skater" description="Para ver a conta, bloquear ou excluir." />
          )}
        </div>
      </div>
    </>
  );
}

export default function SkatersPage() {
  return (
    <RequireRole roles={["ADM"]}>
      <Suspense fallback={<PageLoading />}>
        <SkatersList />
      </Suspense>
    </RequireRole>
  );
}
