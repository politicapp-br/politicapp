import { useEffect } from "react"
import {
  Easing,
  ReduceMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"

/** Configuração da animação de entrada de uma série (`false` desliga). */
export type EntryAnimation =
  | { type: "timing"; duration?: number; progress?: [number, number] }
  | {
      type: "spring"
      damping?: number
      stiffness?: number
      progress?: [number, number]
    }

/**
 * Progresso 0→1 disparado ao montar, compartilhado pelas séries animadas.
 * Respeita a preferência de movimento reduzido do sistema; mude `resetKey`
 * para repetir a animação.
 */
export const useEntryProgress = (
  animation: EntryAnimation | false,
  resetKey?: number | string | boolean | null,
): SharedValue<number> => {
  const [from, to] = (animation === false ? undefined : animation.progress) ?? [0, 1]
  const progress = useSharedValue(animation === false ? to : from)

  useEffect(() => {
    if (animation === false) return
    progress.set(from)
    if (animation.type === "spring") {
      progress.set(
        withSpring(to, {
          damping: animation.damping ?? 18,
          stiffness: animation.stiffness ?? 140,
          reduceMotion: ReduceMotion.System,
        }),
      )
    } else {
      progress.set(
        withTiming(to, {
          duration: animation.duration ?? 700,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }),
      )
    }
  }, [resetKey])

  return progress
}
