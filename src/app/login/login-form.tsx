"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";

const ERRORS: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/user-disabled": "Essa conta está desativada.",
  "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos.",
};

export function LoginForm() {
  const router = useRouter();
  const reason = useSearchParams().get("motivo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(reason);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Já logado (e na equipe): o layout do painel confere o papel.
  useEffect(() => onAuthStateChanged(auth, (user) => user && !reason && router.replace("/")), [router, reason]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(ERRORS[(err as { code?: string }).code ?? ""] ?? "Não foi possível entrar.");
      setLoading(false);
    }
  }

  async function forgot() {
    setError(null);
    if (!email.trim()) {
      setError("Digite seu e-mail para receber o link.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // Não revela se o e-mail existe.
    }
    setInfo("Se o e-mail estiver cadastrado, você vai receber um link para criar uma senha nova.");
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="E-mail">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Senha">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <ErrorNote message={error} />
        {info && <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">{info}</p>}
        <Button type="submit" loading={loading}>
          Entrar
        </Button>
        <button type="button" onClick={forgot} className="text-sm text-muted hover:text-ink">
          Esqueci minha senha
        </button>
      </form>
    </Card>
  );
}
