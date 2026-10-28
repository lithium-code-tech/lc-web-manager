"use client";

import { useMemo, useState, type FormEvent } from "react";
import { collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { api, errorMessage } from "@/lib/api";
import { useLiveQuery } from "@/lib/hooks";
import type { AdSlot } from "@/lib/models";
import { BoardPreview } from "@/components/board-preview";
import { RequireRole } from "@/components/shell";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, PageLoading, useToast } from "@/components/ui";

/** A primeira posição, já combinada com o app: a placa abaixo do vídeo. */
const BOARD_SLOT: AdSlot = {
  id: "placa-video",
  name: "Placa abaixo do vídeo",
  description: "Faixa logo abaixo do vídeo do desafio e das respostas, como as placas na beira do campo.",
  width: 1200,
  height: 200,
  active: true,
};

function SlotEditor({ slot, isNew, onDone }: { slot: AdSlot; isNew: boolean; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(slot);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/api/slots", { method: "POST", body: form });
      toast("Posição salva.");
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Código" hint="Usado pelo app para achar a posição. Não muda depois.">
        <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!isNew} required />
      </Field>
      <Field label="Nome">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Descrição">
        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Largura da arte (px)">
          <Input type="number" value={form.width} onChange={(e) => setForm({ ...form, width: Number(e.target.value) })} required />
        </Field>
        <Field label="Altura da arte (px)">
          <Input type="number" value={form.height} onChange={(e) => setForm({ ...form, height: Number(e.target.value) })} required />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[var(--color-brand)]" />
        Disponível para novas campanhas
      </label>
      <ErrorNote message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

function Slots() {
  const [editing, setEditing] = useState<{ slot: AdSlot; isNew: boolean } | null>(null);
  const q = useMemo(() => collection(db, "adSlots"), []);
  const { data, loading, error } = useLiveQuery(q, "slots", (id, d) => ({ ...(d as AdSlot), id }));
  const hasBoard = data.some((slot) => slot.id === BOARD_SLOT.id);

  return (
    <>
      <PageHeader
        title="Posições no app"
        description="Lugares do app onde um anúncio pode aparecer. O app precisa conhecer o código da posição para exibir."
        actions={
          <Button
            variant="secondary"
            onClick={() => setEditing({ slot: { id: "", name: "", description: "", width: 1080, height: 1080, active: true }, isNew: true })}
          >
            Nova posição
          </Button>
        }
      />
      <ErrorNote message={error} />
      {loading && <PageLoading />}
      {!loading && !hasBoard && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-4 border-brand/60">
          <div>
            <p className="font-semibold">Criar a placa abaixo do vídeo</p>
            <p className="text-sm text-muted">A primeira posição prevista no app, com arte de 1200×200px.</p>
          </div>
          <Button onClick={() => setEditing({ slot: BOARD_SLOT, isNew: true })}>Criar</Button>
        </Card>
      )}
      {!loading && data.length === 0 && <EmptyState title="Nenhuma posição ainda" />}
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((slot) => (
          <Card key={slot.id} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{slot.name}</p>
                <p className="text-sm text-muted">{slot.description}</p>
                <p className="mt-1 text-xs text-muted">
                  <code>{slot.id}</code> · {slot.width}×{slot.height}px
                </p>
              </div>
              <Badge tone={slot.active ? "ok" : "neutral"}>{slot.active ? "Ativa" : "Inativa"}</Badge>
            </div>
            {slot.id === BOARD_SLOT.id && <BoardPreview mediaUrl="" width={slot.width} height={slot.height} />}
            <Button variant="secondary" size="sm" onClick={() => setEditing({ slot, isNew: false })}>
              Editar
            </Button>
          </Card>
        ))}
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.isNew ? "Nova posição" : "Editar posição"}>
        {editing && <SlotEditor key={editing.slot.id || "new"} slot={editing.slot} isNew={editing.isNew} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

export default function SlotsPage() {
  return (
    <RequireRole roles={["ADM"]}>
      <Slots />
    </RequireRole>
  );
}
