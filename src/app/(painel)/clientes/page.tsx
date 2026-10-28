"use client";

import { useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { errorMessage } from "@/lib/api";
import { useLiveQuery } from "@/lib/hooks";
import { isValidCnpj, maskCnpj } from "@/lib/domain/cnpj";
import type { Client } from "@/lib/models";
import { RequireRole } from "@/components/shell";
import { Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, PageLoading, useToast } from "@/components/ui";

type ClientForm = Omit<Client, "id">;

const EMPTY: ClientForm = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  inscricaoEstadual: "",
  endereco: "",
  telefone: "",
  email: "",
  responsavel: "",
};

function ClientEditor({ client, onDone }: { client: Client | null; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<ClientForm>(client ? { ...EMPTY, ...client } : EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof ClientForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidCnpj(form.cnpj)) {
      setError("CNPJ inválido. Confira os números.");
      return;
    }
    setSaving(true);
    try {
      const duplicate = await getDocs(query(collection(db, "Client"), where("cnpj", "==", form.cnpj), limit(1)));
      if (!duplicate.empty && duplicate.docs[0].id !== client?.id) {
        setError("Já existe um cliente com esse CNPJ.");
        return;
      }
      const data = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, (v ?? "").trim()])) as ClientForm;
      if (client) await setDoc(doc(db, "Client", client.id), data);
      else await addDoc(collection(db, "Client"), data);
      toast(client ? "Cliente atualizado." : "Cliente cadastrado.");
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const text = (key: keyof ClientForm, label: string, props: { type?: string; required?: boolean } = {}) => (
    <Field label={label}>
      <Input type={props.type ?? "text"} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} required={props.required} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="CNPJ">
        <Input value={form.cnpj} onChange={(e) => set("cnpj", maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" required />
      </Field>
      {text("inscricaoEstadual", "Inscrição estadual (opcional)")}
      {text("razaoSocial", "Razão social", { required: true })}
      {text("nomeFantasia", "Nome fantasia (aparece no app)", { required: true })}
      <div className="sm:col-span-2">{text("endereco", "Endereço", { required: true })}</div>
      {text("responsavel", "Responsável", { required: true })}
      {text("telefone", "Telefone", { required: true })}
      <div className="sm:col-span-2">{text("email", "E-mail", { type: "email", required: true })}</div>
      <div className="sm:col-span-2">
        <ErrorNote message={error} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
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

function Clients() {
  const toast = useToast();
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [search, setSearch] = useState("");
  const q = useMemo(() => collection(db, "Client"), []);
  const { data, loading, error } = useLiveQuery(q, "clients", (id, d) => ({ ...(d as Client), id }));
  const term = search.trim().toLowerCase();
  const visible = data
    .filter((c) => !term || [c.nomeFantasia, c.razaoSocial, c.cnpj].some((v) => v?.toLowerCase().includes(term)))
    .sort((a, b) => (a.nomeFantasia || a.razaoSocial).localeCompare(b.nomeFantasia || b.razaoSocial));

  async function remove(client: Client) {
    if (!window.confirm(`Excluir ${client.nomeFantasia || client.razaoSocial}? As campanhas existentes guardam uma cópia dos dados.`)) return;
    try {
      await deleteDoc(doc(db, "Client", client.id));
      toast("Cliente excluído.");
    } catch (err) {
      toast(errorMessage(err), "danger");
    }
  }

  return (
    <>
      <PageHeader title="Clientes" description="Empresas que anunciam no SkateGo." actions={<Button onClick={() => setEditing("new")}>Novo cliente</Button>} />
      <Input className="mb-4 max-w-xs" placeholder="Buscar por nome ou CNPJ" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ErrorNote message={error} />
      {loading && <PageLoading />}
      {!loading && visible.length === 0 && <EmptyState title="Nenhum cliente" description="Cadastre o primeiro anunciante." />}
      {visible.length > 0 && (
        <Card className="divide-y divide-line p-0">
          {visible.map((client) => (
            <div key={client.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{client.nomeFantasia || client.razaoSocial}</p>
                <p className="text-sm text-muted">
                  {client.cnpj} · {client.responsavel} · {client.email}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditing(client)}>
                Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(client)}>
                Excluir
              </Button>
            </div>
          ))}
        </Card>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo cliente" : "Editar cliente"}>
        {editing !== null && <ClientEditor key={editing === "new" ? "new" : editing.id} client={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

export default function ClientsPage() {
  return (
    <RequireRole roles={["ADM", "MKT"]}>
      <Clients />
    </RequireRole>
  );
}
