"use client";

import { auth } from "@/lib/firebase/client";

/** Chama a API do painel com o token de quem está logado. Erros viram Error com a mensagem da API. */
export async function api<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? `Erro ${response.status}`);
  return json as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Algo deu errado.";
}
