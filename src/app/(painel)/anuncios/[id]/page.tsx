import { Suspense } from "react";
import { PageLoading } from "@/components/ui";
import { CampaignEditor } from "./campaign-editor";

export default function CampaignPage({ params }: PageProps<"/anuncios/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <CampaignEditor id={params.then((p) => p.id)} />
    </Suspense>
  );
}
