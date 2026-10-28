"use client";

import { useState, type FormEvent } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { ROLE_LABELS } from "@/lib/models";
import { useStaff } from "@/components/auth-provider";
import { Button, Card, ErrorNote, Field, Input, PageHeader, useToast } from "@/components/ui";

export default function AccountPage() {
  const { user, staff } = useStaff();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (next.length < 8) return setError("A senha nova precisa ter pelo menos 8 caracteres.");
    if (next !== confirm) return setError("As senhas novas não são iguais.");
    setSaving(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", current));
      await updatePassword(user, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Senha alterada.");
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code === "auth/invalid-credential" || code === "auth/wrong-password" ? "Senha atual incorreta." : "Não foi possível trocar a senha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Minha conta" description={`${staff.name} · ${staff.email} · ${ROLE_LABELS[staff.rule]}`} />
      <Card className="max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h2 className="font-semibold">Trocar senha</h2>
          <Field label="Senha atual">
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
          <Field label="Senha nova" hint="Pelo menos 8 caracteres.">
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </Field>
          <Field label="Repita a senha nova">
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          <ErrorNote message={error} />
          <Button type="submit" loading={saving}>
            Salvar
          </Button>
        </form>
      </Card>
    </>
  );
}
