"use client";

import { useEffect, useState } from "react";
import { onSnapshot, type DocumentData, type Query } from "firebase/firestore";

type LiveState<T> = { data: T[]; loading: boolean; error: string | null };

/**
 * Lista em tempo real de uma query do Firestore. `query` pode ser null (ainda
 * sem filtro). `key` identifica a query: quando muda, a lista recarrega.
 */
export function useLiveQuery<T>(
  query: Query<DocumentData> | null,
  key: string,
  map: (id: string, data: DocumentData) => T,
): LiveState<T> {
  const [state, setState] = useState<{ key: string | null; data: T[]; error: string | null }>({
    key: null,
    data: [],
    error: null,
  });

  useEffect(() => {
    if (!query) return;
    return onSnapshot(
      query,
      (snapshot) => setState({ key, data: snapshot.docs.map((doc) => map(doc.id, doc.data())), error: null }),
      () => setState({ key, data: [], error: "Não foi possível carregar. Confira sua permissão." }),
    );
    // `key` representa a query; `map` é estável na prática.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!query) return { data: [], loading: false, error: null };
  const current = state.key === key;
  return { data: current ? state.data : [], loading: !current, error: current ? state.error : null };
}
