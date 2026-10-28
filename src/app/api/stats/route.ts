import { adminDb } from "@/lib/firebase/admin";
import { loadCases } from "@/lib/server/reports";
import { requireStaff, route } from "@/lib/server/http";

export const GET = route(async (request) => {
  const staff = await requireStaff(request, ["ADM", "MKT"]);
  const db = adminDb();
  const [skaters, challenges, banned, placements, awaitingPayment, cases] = await Promise.all([
    db.collection("Skater").count().get(),
    db.collection("Challenges").count().get(),
    db.collection("Skater").where("banned", "==", true).count().get(),
    db.collection("adPlacements").count().get(),
    db.collection("Campaign").where("payment.status", "==", "pending").count().get(),
    staff.rule === "ADM" ? loadCases() : Promise.resolve(null),
  ]);
  return Response.json({
    skaters: skaters.data().count,
    challenges: challenges.data().count,
    banned: banned.data().count,
    publishedAds: placements.data().count,
    awaitingPayment: awaitingPayment.data().count,
    openReports: cases ? cases.filter((c) => c.pendingCount > 0).length : null,
  });
});
