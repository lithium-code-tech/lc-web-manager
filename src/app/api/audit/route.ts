import { adminDb } from "@/lib/firebase/admin";
import { requireStaff, route } from "@/lib/server/http";

export const GET = route(async (request) => {
  await requireStaff(request, ["ADM"]);
  const snapshot = await adminDb().collection("auditLog").orderBy("at", "desc").limit(200).get();
  return Response.json({ entries: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
});
