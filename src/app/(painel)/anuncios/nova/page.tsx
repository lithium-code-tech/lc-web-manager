"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { RequireRole } from "@/components/shell";
import { PageHeader, useToast } from "@/components/ui";
import { CampaignForm, valuesFrom } from "../campaign-form";

function NewCampaign() {
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <PageHeader
        title="Nova campanha"
        description="Pode salvar incompleta e terminar depois. Ela fica como rascunho até ter cliente, posição, arte e período."
      />
      <CampaignForm
        initial={valuesFrom()}
        submitLabel="Criar campanha"
        onSubmit={async (values) => {
          const { id } = await api<{ id: string }>("/api/campaigns", { method: "POST", body: values });
          toast("Campanha criada.");
          router.replace(`/anuncios/${id}`);
        }}
      />
    </>
  );
}

export default function NewCampaignPage() {
  return (
    <RequireRole roles={["ADM", "MKT"]}>
      <NewCampaign />
    </RequireRole>
  );
}
