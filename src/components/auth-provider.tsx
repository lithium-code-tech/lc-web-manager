"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { StaffRole, StaffUser } from "@/lib/models";

type AuthState =
  | { status: "loading" }
  | { status: "signed-out"; reason?: string }
  | { status: "ready"; user: User; staff: StaffUser };

const AuthContext = createContext<AuthState>({ status: "loading" });

/** Só entra quem tem doc em User/{uid} com papel ADM ou MKT. Skater do app é recusado. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState((current) => ({ status: "signed-out", reason: current.status === "signed-out" ? current.reason : undefined }));
          return;
        }
        try {
          const snapshot = await getDoc(doc(db, "User", user.uid));
          const staff = snapshot.data() as StaffUser | undefined;
          if (!staff || !["ADM", "MKT"].includes(staff.rule)) throw new Error("not-staff");
          setState({ status: "ready", user, staff: { ...staff, userId: user.uid } });
        } catch {
          setState({ status: "signed-out", reason: "Essa conta não faz parte da equipe do painel." });
          await signOut(auth);
        }
      }),
    [],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Para telas dentro do painel (o layout já garante status "ready"). */
export function useStaff(): { user: User; staff: StaffUser; can: (...roles: StaffRole[]) => boolean } {
  const state = useContext(AuthContext);
  if (state.status !== "ready") throw new Error("useStaff fora do painel autenticado");
  return { user: state.user, staff: state.staff, can: (...roles) => roles.includes(state.staff.rule) };
}
