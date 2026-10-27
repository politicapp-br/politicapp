import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { QueryClient } from "@tanstack/react-query"

import { DURATION } from "@/services/api/query-keys"
import { storage } from "@/utils/storage"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DURATION.hour,
      gcTime: DURATION.day * 7,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

export const persister = createSyncStoragePersister({
  storage: {
    getItem: (key) => storage.getString(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.remove(key),
  },
  key: "politicapp-cache",
})

export const persistOptions = {
  persister,
  maxAge: DURATION.day * 7,
}
