import * as Haptics from "expo-haptics"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { Gesture } from "react-native-gesture-handler"
import {
  useAnimatedReaction,
  useSharedValue,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"

import type { ChartActions, PressState } from "./cartesian-root"

type Options = {
  /** Tempo (ms) que a seleção fica visível após o toque (padrão 2500). */
  selectionDuration?: number
  /** Vibração sutil a cada seleção (padrão ligada). */
  haptics?: boolean
}

/**
 * Toque rápido para inspecionar um ponto/barra: complementa o gesto de
 * arrastar do victory-native (que só ativa com o dedo pousado ~100 ms) com um
 * tap que seleciona o dado mais próximo e mantém a seleção visível por alguns
 * segundos — arrastar e soltar também mantém. Passe `gesture` em
 * `customGestures` e `actionsRef` em `actionsRef` do gráfico, junto do
 * `chartPressState` de sempre.
 */
export const useChartTap = <State extends PressState>(
  state: State,
  { selectionDuration = 2500, haptics = true }: Options = {},
) => {
  const actionsRef = useSharedValue<ChartActions | null>(null)
  // O pan interno do victory-native derruba `isActive` ao fim de todo toque,
  // mesmo quando nunca ativou (perdeu a disputa para o tap); este flag guarda
  // a intenção de manter a seleção para reafirmá-la em qualquer ordem de
  // callbacks.
  const selectionHeld = useSharedValue(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleExpiry = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      selectionHeld.set(false)
      state.isActive.set(false)
    }, selectionDuration)
  }, [state, selectionDuration, selectionHeld])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // Tudo na thread de UI: o handleTouch do victory-native é um worklet e o
  // actionsRef compartilhado o expõe sem pular para a thread de JS.
  const gesture = useMemo(
    () =>
      Gesture.Tap().onEnd((event, success) => {
        if (!success) return
        const actions = actionsRef.get()
        if (!actions) return
        actions.handleTouch(state, event.x, event.y)
        state.isActive.set(true)
      }),
    [actionsRef, state],
  )

  useAnimatedReaction(
    () => state.isActive.get(),
    (active) => {
      if (!active && selectionHeld.get() && state.matchedIndex.get() >= 0) {
        state.isActive.set(true)
      }
    },
  )

  const vibrate = () => {
    Haptics.selectionAsync()
  }
  useAnimatedReaction(
    () => (state.isActive.get() ? state.matchedIndex.get() : -1),
    (current, previous) => {
      if (current < 0) return
      selectionHeld.set(true)
      scheduleOnRN(scheduleExpiry)
      if (haptics && current !== previous) scheduleOnRN(vibrate)
    },
  )

  return { gesture, actionsRef }
}
