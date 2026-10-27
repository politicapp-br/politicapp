import { Canvas, Path, Skia } from "@shopify/react-native-skia"
import * as Haptics from "expo-haptics"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, type LayoutChangeEvent } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import {
  ReduceMotion,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"

import { cn } from "@/utils/cn"

import { useEntryProgress, type EntryAnimation } from "./entry-animation"
import {
  findTappedSlice,
  buildDonutArcs,
  type DonutGeometry,
} from "./donut-layout"

const DEFAULT_ENTERING: EntryAnimation = { type: "timing", duration: 800 }

/** Opacidade das fatias esmaecidas enquanto outra está selecionada. */
const DIMMED_OPACITY = 0.35

export type DonutSlice = {
  value: number
  /** Cor da fatia — use `useChartColors().series` para a paleta do tema. */
  color: string
}

type SliceProps = {
  index: number
  color: string
  start: number
  sweep: number
  centerX: number
  centerY: number
  midRadius: number
  thickness: number
  progress: SharedValue<number>
  selected: SharedValue<number>
}

/**
 * Arco traçado no raio médio com strokeWidth = espessura do anel. Entrada e
 * destaque vivem em shared values ligados direto às props Skia — mudar a
 * seleção não re-renderiza nada em React.
 */
const Slice = ({
  index,
  color,
  start,
  sweep,
  centerX,
  centerY,
  midRadius,
  thickness,
  progress,
  selected,
}: SliceProps) => {
  const path = useDerivedValue(() => {
    const p = progress.get()
    const arcPath = Skia.PathBuilder.Make()
    if (p > 0 && sweep > 0) {
      arcPath.addArc(
        {
          x: centerX - midRadius,
          y: centerY - midRadius,
          width: midRadius * 2,
          height: midRadius * 2,
        },
        // Skia mede a partir das 3h; nossos ângulos, das 12h. Multiplicar os
        // dois ângulos pelo progresso faz a rosca varrer das 12h ao montar.
        start * p - 90,
        sweep * p,
      )
    }
    return arcPath.detach()
  })

  const opacity = useDerivedValue(() => {
    const current = selected.get()
    return withTiming(
      current === -1 || current === index ? 1 : DIMMED_OPACITY,
      { duration: 150, reduceMotion: ReduceMotion.System },
    )
  })

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={thickness}
      color={color}
      opacity={opacity}
    />
  )
}

type Props = {
  /** Fatias em ordem, a partir das 12h em sentido horário. */
  slices: DonutSlice[]
  /**
   * Chamado uma vez por mudança de seleção (`null` = nada selecionado) — é o
   * único ponto que atravessa para a thread de JS; use para o rótulo central.
   */
  onSelectionChange?: (index: number | null) => void
  /** Tempo (ms) que a seleção fica visível após o toque (padrão 2500). */
  selectionDuration?: number
  /** Vibração sutil ao selecionar fatia nova (padrão ligada). */
  haptics?: boolean
  /** Raio interno como fração do externo (padrão 0.65). */
  innerRadiusRatio?: number
  /** Vão angular entre fatias, em graus (padrão 2). */
  gapDegrees?: number
  /** Varredura progressiva ao montar (padrão ligada; `false` desliga). */
  entering?: EntryAnimation | false
  /** Mude o valor para repetir a animação de entrada. */
  resetKey?: number | string | boolean | null
  wrapperClassName?: string
  accessibilityLabel?: string
}

/**
 * Rosca de composição desenhada com Skia. Tocar numa fatia a destaca na hora
 * (já no toque-para-baixo), com haptic e expiração automática; tocar fora do
 * anel desfaz. Todo o caminho do toque roda na thread de UI.
 */
export const DonutChart = ({
  slices,
  onSelectionChange,
  selectionDuration = 2500,
  haptics = true,
  innerRadiusRatio = 0.65,
  gapDegrees = 2,
  entering = DEFAULT_ENTERING,
  resetKey,
  wrapperClassName,
  accessibilityLabel,
}: Props) => {
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  )
  const progress = useEntryProgress(entering, resetKey)
  const selected = useSharedValue(-1)
  const previous = useSharedValue(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize({ width, height })
  }

  const geometry = useMemo<DonutGeometry | null>(() => {
    if (!size) return null
    const outerRadius = Math.min(size.width, size.height) / 2
    if (outerRadius <= 0) return null
    return {
      centerX: size.width / 2,
      centerY: size.height / 2,
      innerRadius: outerRadius * innerRadiusRatio,
      outerRadius,
      arcs: buildDonutArcs(
        slices.map((slice) => slice.value),
        gapDegrees,
      ),
    }
  }, [size, slices, innerRadiusRatio, gapDegrees])

  // O gesto precisa de identidade estável (recriá-lo a cada render faz o
  // GestureDetector reanexar o handler e descartar o toque feito logo após um
  // render), então o worklet não pode capturar valores de render: a geometria
  // chega por um shared value.
  const gestureGeometry = useSharedValue<DonutGeometry | null>(null)
  useEffect(() => {
    gestureGeometry.set(geometry)
  }, [geometry, gestureGeometry])

  // Haptic + expiração ficam na thread de JS, fora do caminho visual do
  // toque; o ref mantém as props atuais sem invalidar o gesto.
  const handleSliceTap = (index: number, isNew: boolean) => {
    if (timer.current) clearTimeout(timer.current)
    if (index === -1) return
    if (isNew && haptics) Haptics.selectionAsync()
    timer.current = setTimeout(() => {
      selected.set(-1)
    }, selectionDuration)
  }
  const handleSliceTapRef = useRef(handleSliceTap)
  handleSliceTapRef.current = handleSliceTap
  const dispatchTap = useCallback((index: number, isNew: boolean) => {
    handleSliceTapRef.current(index, isNew)
  }, [])

  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const syncSelection = useCallback((index: number) => {
    onSelectionChangeRef.current?.(index === -1 ? null : index)
  }, [])

  // Uma ida ao JS por mudança de seleção (nunca por frame): atualiza o rótulo
  // central de quem consome, inclusive na expiração e na reversão.
  useAnimatedReaction(
    () => selected.get(),
    (current, before) => {
      if (before === null || current === before) return
      scheduleOnRN(syncSelection, current)
    },
  )

  const gesture = useMemo(
    () =>
      Gesture.Tap()
        // Dentro de rolagem o dedo desliza uns pixels e o toque pode passar
        // de 500 ms; as tolerâncias padrão do Tap falhariam nesses casos.
        .maxDuration(1000)
        .maxDistance(24)
        // Seleção já no toque-para-baixo: feedback instantâneo, sem esperar o
        // dedo levantar.
        .onBegin((event) => {
          const geo = gestureGeometry.get()
          if (!geo) return
          const before = selected.get()
          previous.set(before)
          const index = findTappedSlice(event.x, event.y, geo)
          selected.set(index)
          scheduleOnRN(dispatchTap, index, index !== before)
        })
        // Tap que virou rolagem: desfaz a seleção tentativa do onBegin.
        .onFinalize((_event, success) => {
          if (!success) selected.set(previous.get())
        }),
    [dispatchTap, gestureGeometry, selected, previous],
  )

  return (
    <GestureDetector gesture={gesture}>
      <View
        className={cn("h-56 w-full", wrapperClassName)}
        onLayout={handleLayout}
        accessible={accessibilityLabel != null}
        accessibilityRole={accessibilityLabel != null ? "image" : undefined}
        accessibilityLabel={accessibilityLabel}
      >
        {size && geometry ? (
          <Canvas style={{ width: size.width, height: size.height }}>
            {geometry.arcs.map((arc, index) => (
              <Slice
                key={index}
                index={index}
                color={slices[index]?.color ?? "transparent"}
                start={arc.start}
                sweep={arc.sweep}
                centerX={geometry.centerX}
                centerY={geometry.centerY}
                midRadius={(geometry.outerRadius + geometry.innerRadius) / 2}
                thickness={geometry.outerRadius - geometry.innerRadius}
                progress={progress}
                selected={selected}
              />
            ))}
          </Canvas>
        ) : null}
      </View>
    </GestureDetector>
  )
}
