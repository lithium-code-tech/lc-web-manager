"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { Shell } from "@/components/shell";
import { PageLoading, ToastProvider } from "@/components/ui";

function Gate({ children }: { children: ReactNode }) {
  const state = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "signed-out") {
      router.replace(state.reason ? `/login?motivo=${encodeURIComponent(state.reason)}` : "/login");
    }
  }, [state, router]);

  if (state.status !== "ready") return <PageLoading />;
  return <Shell>{children}</Shell>;
}

export default function PainelLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate>{children}</Gate>
      </ToastProvider>
    </AuthProvider>
  );
}
