import { Button } from "heroui-native"
import { useState, type ReactNode } from "react"
import { View } from "react-native"

import { cn } from "@/utils/cn"

type Props<T> = {
  items: readonly T[]
  /** Quantos itens aparecem antes do "Ver mais"; sem valor, mostra todos. */
  initialCount?: number
  keyExtractor: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
}

/**
 * Linhas separadas por borda (a primeira sem) e, quando a lista passa de
 * `initialCount`, um botão "Ver mais N" que mostra o restante. Devolve um
 * fragmento para herdar o espaçamento do cartão que a contém.
 */
export const ExpandableList = <T,>({
  items,
  initialCount,
  keyExtractor,
  renderItem,
}: Props<T>) => {
  const [expanded, setExpanded] = useState(false)

  const visible =
    expanded || initialCount === undefined
      ? items
      : items.slice(0, initialCount)
  const hiddenCount = items.length - visible.length

  return (
    <>
      {visible.map((item, index) => (
        <View
          key={keyExtractor(item, index)}
          className={cn(index > 0 && "border-t border-border")}
        >
          {renderItem(item, index)}
        </View>
      ))}

      {hiddenCount > 0 ? (
        <Button size="sm" variant="ghost" onPress={() => setExpanded(true)}>
          {`Ver mais ${hiddenCount}`}
        </Button>
      ) : null}
    </>
  )
}
