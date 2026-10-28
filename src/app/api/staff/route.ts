import { randomBytes } from "node:crypto";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { STAFF_ROLES, type StaffUser } from "@/lib/models";
import { audit } from "@/lib/server/audit";
import { HttpError, readBody, requireStaff, route } from "@/lib/server/http";

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  email: z.email("E-mail inválido.").transform((email) => email.toLowerCase()),
  phoneNumber: z.string().trim().max(30).default(""),
  rule: z.enum(STAFF_ROLES),
});

/**
 * Adiciona alguém à equipe. Se o e-mail ainda não tem login, cria um com senha
 * aleatória — o painel manda em seguida o e-mail para a pessoa definir a dela.
 */
export const POST = route(async (request) => {
  const staff = await requireStaff(request, ["ADM"]);
  const { name, email, phoneNumber, rule } = await readBody(request, schema);

  let uid: string;
  let existingAccount = false;
  try {
    uid = (await adminAuth().getUserByEmail(email)).uid;
    existingAccount = true;
  } catch {
    uid = (
      await adminAuth().createUser({ email, displayName: name, password: randomBytes(24).toString("base64url") })
    ).uid;
  }

  const ref = adminDb().doc(`User/${uid}`);
  if ((await ref.get()).exists) throw new HttpError(409, "Essa pessoa já está na equipe.");
  const user: StaffUser = { userId: uid, email, name, imageURL: "", phoneNumber, rule };
  await ref.set(user);
  await audit(staff, "staff.create", { type: "staff", id: uid }, `adicionou ${name} (${rule}) à equipe`);
  return Response.json({ user, existingAccount });
});
