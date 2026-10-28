import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { audit } from "@/lib/server/audit";
import { readBody, requireStaff, route } from "@/lib/server/http";

const schema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{3,40}$/, "Use só letras minúsculas, números e hífen (ex.: placa-video)."),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(""),
  width: z.number().int().min(50).max(5000),
  height: z.number().int().min(50).max(5000),
  active: z.boolean().default(true),
});

/** Cria ou atualiza uma posição de anúncio no app (o código do app usa o id). */
export const POST = route(async (request) => {
  const staff = await requireStaff(request, ["ADM"]);
  const slot = await readBody(request, schema);
  await adminDb().doc(`adSlots/${slot.id}`).set(slot);
  await audit(staff, "slot.save", { type: "slot", id: slot.id }, `salvou a posição "${slot.name}"`);
  return Response.json({ slot });
});
