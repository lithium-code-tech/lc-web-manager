// firebase-admin para as rotas /api — ignora as regras, então toda rota confere
// o papel de quem chama antes (lib/server/http.ts). Só importar no servidor.
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  // Emulador local: sem credencial (FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST).
  if (process.env.FIRESTORE_EMULATOR_HOST) return initializeApp({ projectId });

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccount) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON não configurada.");
  return initializeApp({ credential: cert(JSON.parse(serviceAccount)), projectId });
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
