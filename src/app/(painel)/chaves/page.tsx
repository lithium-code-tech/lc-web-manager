"use client";

import { useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { errorMessage } from "@/lib/api";
import { useLiveQuery } from "@/lib/hooks";
import { RequireRole } from "@/components/shell";
import { Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, PageLoading, useToast } from "@/components/ui";

type Toggle = { id: string; key: string; feature: string; description: string; enabled: boolean };

function Toggles() {
  const toast = useToast();
  const [form, setForm] = useState({ key: "", feature: "", description: "" });
  const [saving, setSaving] = useState(false);
  const q = useMemo(() => collection(db, "Feature-toggle"), []);
  const { data, loading, error } = useLiveQuery(q, "toggles", (id, d) => ({ ...(d as Toggle), id }));

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await addDoc(collection(db, "Feature-toggle"), { ...form, enabled: true });
      setForm({ key: "", feature: "", description: "" });
      toast("Chave criada.");
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  }

  async function flip(toggle: Toggle) {
    try {
      await updateDoc(doc(db, "Feature-toggle", toggle.id), { enabled: !toggle.enabled });
    } catch (err) {
      toast(errorMessage(err), "danger");
    }
  }

  return (
    <>
      <PageHeader title="Chaves do app" description="Liga e desliga funcionalidades do app sem publicar versão nova (feature toggles)." />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          <ErrorNote message={error} />
          {loading && <PageLoading />}
          {!loading && data.length === 0 && <EmptyState title="Nenhuma chave" />}
          {data.length > 0 && (
            <Card className="divide-y divide-line p-0">
              {[...data]
                .sort((a, b) => a.key.localeCompare(b.key))
                .map((toggle) => (
                  <label key={toggle.id} className="flex cursor-pointer items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{toggle.feature || toggle.key}</p>
                      <p className="text-sm text-muted">
                        <code>{toggle.key}</code>
                        {toggle.description && <> · {toggle.description}</>}
                      </p>
                    </div>
                    <input type="checkbox" role="switch" checked={toggle.enabled} onChange={() => flip(toggle)} className="size-5 accent-[var(--color-brand)]" />
                  </label>
                ))}
            </Card>
          )}
        </div>
        <Card>
          <form onSubmit={create} className="flex flex-col gap-4">
            <h2 className="font-semibold">Nova chave</h2>
            <Field label="Código" hint="Ex.: ads_board_enabled">
              <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} required />
            </Field>
            <Field label="Funcionalidade">
              <Input value={form.feature} onChange={(e) => setForm({ ...form, feature: e.target.value })} required />
            </Field>
            <Field label="Descrição">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Button type="submit" loading={saving}>
              Criar
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}

export default function TogglesPage() {
  return (
    <RequireRole roles={["ADM"]}>
      <Toggles />
    </RequireRole>
  );
}
