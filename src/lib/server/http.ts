// Base das rotas /api: confere o token do Firebase, o papel na equipe
// (User/{uid}.rule) e devolve erros em JSON com mensagem em português.
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { StaffRole } from "@/lib/models";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Staff = { uid: string; name: string; email: string; rule: StaffRole };

export async function requireStaff(request: Request, roles: readonly StaffRole[]): Promise<Staff> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Faça login de novo.");

  let uid: string;
  try {
    // checkRevoked: quem foi removido da equipe perde o acesso na hora.
    ({ uid } = await adminAuth().verifyIdToken(token, true));
  } catch {
    throw new HttpError(401, "Sessão expirada. Faça login de novo.");
  }

  const snapshot = await adminDb().doc(`User/${uid}`).get();
  const data = snapshot.data();
  if (!data || !roles.includes(data.rule)) throw new HttpError(403, "Você não tem permissão para isso.");
  return { uid, name: data.name ?? "", email: data.email ?? "", rule: data.rule };
}

export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new HttpError(400, "Corpo da requisição inválido.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HttpError(400, issue?.message ?? "Dados inválidos.");
  }
  return parsed.data;
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Envolve a rota: HttpError vira JSON com o status; o resto vira 500 e vai pro log. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Erros internos do Next (ex.: fim do prerender ao ler headers) não são nossos.
      unstable_rethrow(error);
      if (error instanceof HttpError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      console.error(error);
      return Response.json({ error: "Erro inesperado. Tente de novo." }, { status: 500 });
    }
  };
}
