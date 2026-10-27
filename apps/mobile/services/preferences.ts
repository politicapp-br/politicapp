import { parlamentarKey, type ParlamentarRef } from "@politicapp/data"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { storage } from "@/utils/storage"

type Preferences = {
  uf: string | null
  /** Chaves `casa:id` (ver `parlamentarKey`). */
  followed: string[]
  setUf: (uf: string) => void
  toggleFollow: (ref: ParlamentarRef) => void
}

const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.remove(key),
}

export const usePreferences = create<Preferences>()(
  persist(
    (set, get) => ({
      uf: null,
      followed: [],
      setUf: (uf) => set({ uf }),
      toggleFollow: (ref) => {
        const key = parlamentarKey(ref)
        const { followed } = get()
        set({
          followed: followed.includes(key)
            ? followed.filter((item) => item !== key)
            : [...followed, key],
        })
      },
    }),
    {
      name: "preferences",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: ({ uf, followed }) => ({ uf, followed }),
    },
  ),
)

/** Seletor: segue ou não este parlamentar (reage a mudanças na lista). */
export const useIsFollowing = (ref: ParlamentarRef) =>
  usePreferences((state) => state.followed.includes(parlamentarKey(ref)))
