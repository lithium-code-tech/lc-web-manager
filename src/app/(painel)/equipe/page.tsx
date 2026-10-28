"use client";

import { useMemo, useState, type FormEvent } from "react";
import { collection } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { api, errorMessage } from "@/lib/api";
import { useLiveQuery } from "@/lib/hooks";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole, type StaffUser } from "@/lib/models";
import { useStaff } from "@/components/auth-provider";
import { RequireRole } from "@/components/shell";
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, PageLoading, Select, useToast } from "@/components/ui";

const ROLE_HELP: Record<StaffRole, string> = {
  ADM: "Tudo: denúncias, contas, equipe, pagamentos.",
  MKT: "Clientes e campanhas (cria, edita, liga e desliga as pagas).",
};

function NewMemberForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", phoneNumber: "", rule: "MKT" as StaffRole });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { existingAccount } = await api<{ existingAccount: boolean }>("/api/staff", { method: "POST", body: form });
      if (existingAccount) {
        toast(`${form.name} entrou na equipe. Já tinha login: usa a mesma senha do app.`);
      } else {
        await sendPasswordResetEmail(auth, form.email);
        toast(`${form.name} entrou na equipe. Mandamos um e-mail para criar a senha.`);
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nome">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="E-mail" hint="A pessoa recebe um link para criar a senha.">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      </Field>
      <Field label="Celular (opcional)">
        <Input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
      </Field>
      <Field label="Papel" hint={ROLE_HELP[form.rule]}>
        <Select value={form.rule} onChange={(e) => setForm({ ...form, rule: e.target.value as StaffRole })}>
          {STAFF_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </Field>
      <ErrorNote message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Adicionar
        </Button>
      </div>
    </form>
  );
}

function Team() {
  const { staff: me } = useStaff();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<StaffUser | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useMemo(() => collection(db, "User"), []);
  const { data, loading, error } = useLiveQuery(q, "staff", (id, d) => ({ ...(d as StaffUser), userId: id }));
  const members = [...data].sort((a, b) => a.name.localeCompare(b.name));

  async function changeRole(member: StaffUser, rule: StaffRole) {
    try {
      await api(`/api/staff/${member.userId}`, { method: "PATCH", body: { rule } });
      toast(`${member.name} agora é ${ROLE_LABELS[rule]}.`);
    } catch (err) {
      toast(errorMessage(err), "danger");
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/api/staff/${removing.userId}`, { method: "DELETE" });
      toast(`${removing.name} saiu da equipe.`);
      setRemoving(null);
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Quem acessa este painel. Skaters do app não entram aqui."
        actions={<Button onClick={() => setAdding(true)}>Adicionar pessoa</Button>}
      />
      <ErrorNote message={error} />
      {loading ? (
        <PageLoading />
      ) : (
        <Card className="divide-y divide-line p-0">
          {members.map((member) => (
            <div key={member.userId} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {member.name} {member.userId === me.userId && <Badge>você</Badge>}
                </p>
                <p className="truncate text-sm text-muted">{member.email}</p>
              </div>
              {member.userId === me.userId ? (
                <Badge tone="brand">{ROLE_LABELS[member.rule] ?? member.rule}</Badge>
              ) : (
                <>
                  <Select
                    className="w-40"
                    value={member.rule}
                    onChange={(e) => changeRole(member, e.target.value as StaffRole)}
                    aria-label={`Papel de ${member.name}`}
                  >
                    {STAFF_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(member)}>
                    Remover
                  </Button>
                </>
              )}
            </div>
          ))}
        </Card>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Adicionar à equipe">
        {adding && <NewMemberForm onDone={() => setAdding(false)} />}
      </Modal>
      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remover ${removing?.name ?? ""}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              Remover
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          A pessoa perde o acesso ao painel na hora. Se ela também usa o app como skater, a conta do app continua.
        </p>
      </Modal>
    </>
  );
}

export default function TeamPage() {
  return (
    <RequireRole roles={["ADM"]}>
      <Team />
    </RequireRole>
  );
}
