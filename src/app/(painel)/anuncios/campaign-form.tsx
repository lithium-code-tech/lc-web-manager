"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { collection } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { errorMessage } from "@/lib/api";
import { useLiveQuery } from "@/lib/hooks";
import type { AdSlot, Campaign, Client } from "@/lib/models";
import { BoardPreview } from "@/components/board-preview";
import { useStaff } from "@/components/auth-provider";
import { Button, Card, ErrorNote, Field, Input, Select } from "@/components/ui";

export type CampaignFormValues = {
  name: string;
  clientId: string;
  slotIds: string[];
  mediaUrl: string;
  linkUrl: string;
  startDate: string;
  endDate: string;
  priceCents: number;
};

export function valuesFrom(campaign?: Campaign): CampaignFormValues {
  return {
    name: campaign?.name ?? "",
    clientId: campaign?.client.id ?? "",
    slotIds: campaign?.slotIds ?? [],
    mediaUrl: campaign?.mediaUrl ?? "",
    linkUrl: campaign?.linkUrl ?? "",
    startDate: campaign?.startDate ?? "",
    endDate: campaign?.endDate ?? "",
    priceCents: campaign?.priceCents ?? 0,
  };
}

function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = reject;
    image.src = url;
  });
}

export function CampaignForm({
  initial,
  submitLabel,
  onSubmit,
  lockedPaidFields,
}: {
  initial: CampaignFormValues;
  submitLabel: string;
  onSubmit: (values: CampaignFormValues) => Promise<void>;
  /** Campanha paga e quem edita não é ADM: valor e cliente travados. */
  lockedPaidFields?: boolean;
}) {
  const { can } = useStaff();
  const [values, setValues] = useState(initial);
  const [priceText, setPriceText] = useState(initial.priceCents ? (initial.priceCents / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const clientsQuery = useMemo(() => collection(db, "Client"), []);
  const slotsQuery = useMemo(() => collection(db, "adSlots"), []);
  const clients = useLiveQuery(clientsQuery, "clients", (id, d) => ({ ...(d as Client), id }));
  const slots = useLiveQuery(slotsQuery, "slots", (id, d) => ({ ...(d as AdSlot), id }));
  const selectedSlot = slots.data.find((slot) => values.slotIds.includes(slot.id));
  const set = <K extends keyof CampaignFormValues>(key: K, value: CampaignFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function upload(file: File) {
    setError(null);
    setWarning(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Use PNG, JPG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("A arte precisa ter menos de 10 MB.");
      return;
    }
    setUploading(true);
    try {
      if (selectedSlot) {
        const { width, height } = await imageSize(file);
        const expected = selectedSlot.width / selectedSlot.height;
        if (Math.abs(width / height - expected) / expected > 0.05) {
          setWarning(
            `A arte tem ${width}×${height}px. Para "${selectedSlot.name}" o ideal é ${selectedSlot.width}×${selectedSlot.height}px — fora dessa proporção, ela é cortada.`,
          );
        }
      }
      const fileRef = ref(storage, `campaign-images/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_")}`);
      await uploadBytes(fileRef, file, { contentType: file.type });
      set("mediaUrl", await getDownloadURL(fileRef));
    } catch (err) {
      setError(`Não foi possível enviar a arte: ${errorMessage(err)}`);
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <Card className="flex flex-col gap-5">
        <Field label="Nome da campanha">
          <Input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Loja X — novembro" required />
        </Field>

        <Field
          label="Cliente"
          hint={
            clients.data.length === 0 && !clients.loading ? (
              <>
                Nenhum cliente ainda. <Link href="/clientes" className="text-brand underline">Cadastre um</Link>.
              </>
            ) : lockedPaidFields ? (
              "Campanha paga: só um administrador troca o cliente."
            ) : undefined
          }
        >
          <Select value={values.clientId} onChange={(e) => set("clientId", e.target.value)} disabled={lockedPaidFields}>
            <option value="">Selecione…</option>
            {[...clients.data]
              .sort((a, b) => (a.nomeFantasia || a.razaoSocial).localeCompare(b.nomeFantasia || b.razaoSocial))
              .map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nomeFantasia || client.razaoSocial} · {client.cnpj}
                </option>
              ))}
          </Select>
        </Field>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1.5 font-medium">Onde aparece no app</legend>
          {slots.data.length === 0 && !slots.loading && (
            <p className="text-xs text-muted">
              Nenhuma posição cadastrada.{" "}
              {can("ADM") ? (
                <Link href="/posicoes" className="text-brand underline">Criar posições</Link>
              ) : (
                "Peça a um administrador para criar."
              )}
            </p>
          )}
          {slots.data
            .filter((slot) => slot.active || values.slotIds.includes(slot.id))
            .map((slot) => (
              <label key={slot.id} className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5 has-checked:border-brand">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[var(--color-brand)]"
                  checked={values.slotIds.includes(slot.id)}
                  onChange={(e) =>
                    set("slotIds", e.target.checked ? [...values.slotIds, slot.id] : values.slotIds.filter((id) => id !== slot.id))
                  }
                />
                <span>
                  <span className="font-semibold">{slot.name}</span>
                  <span className="block text-xs text-muted">
                    {slot.description} · arte {slot.width}×{slot.height}px
                  </span>
                </span>
              </label>
            ))}
        </fieldset>

        <Field
          label="Arte"
          hint={selectedSlot ? `Ideal: ${selectedSlot.width}×${selectedSlot.height}px, PNG ou JPG, até 10 MB.` : "PNG ou JPG, até 10 MB."}
        >
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="py-1.5 file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-ink"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            disabled={uploading}
          />
        </Field>
        {warning && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{warning}</p>}

        <Field label="Link ao tocar na placa (opcional)" hint="Site, Instagram ou WhatsApp do anunciante.">
          <Input type="url" value={values.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início">
            <Input type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label="Fim (inclusive)">
            <Input type="date" value={values.endDate} min={values.startDate} onChange={(e) => set("endDate", e.target.value)} />
          </Field>
        </div>

        <Field label="Valor (R$)" hint={lockedPaidFields ? "Campanha paga: só um administrador muda o valor." : undefined}>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={priceText}
            onChange={(e) => {
              setPriceText(e.target.value);
              set("priceCents", Math.round(Number(e.target.value || 0) * 100));
            }}
            disabled={lockedPaidFields}
          />
        </Field>

        <ErrorNote message={error} />
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={uploading}>
            {submitLabel}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-3 lg:sticky lg:top-6">
        <p className="text-center text-sm text-muted">Como fica no app</p>
        <BoardPreview mediaUrl={values.mediaUrl} width={selectedSlot?.width} height={selectedSlot?.height} />
        {uploading && <p className="text-center text-sm text-muted">Enviando arte…</p>}
      </div>
    </form>
  );
}
