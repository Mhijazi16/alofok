/**
 * IDB-backed persister for @tanstack/react-query-persist-client.
 *
 * Uses idb-keyval's DEFAULT store (separate from alofok_offline DB used by syncQueue)
 * to avoid version-conflict pitfalls when two modules share one IndexedDB database.
 */

import { get, set, del } from "idb-keyval";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";

export function createIDBPersister(
  idbValidKey: IDBValidKey = "alofok-rq-cache"
): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbValidKey, client);
    },
    restoreClient: async () => {
      return (await get<PersistedClient>(idbValidKey)) ?? undefined;
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  } satisfies Persister;
}
