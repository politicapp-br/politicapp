import { NativeTabs } from "expo-router/native-tabs"

import { useColors } from "@/hooks/use-colors"

export default function TabsLayout() {
  const { brandColor } = useColors()

  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={brandColor}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home_filled" }}
        />
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="parlamentares">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
          md="groups"
        />
        <NativeTabs.Trigger.Label>Parlamentares</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="eleicoes">
        <NativeTabs.Trigger.Icon
          sf={{ default: "checkmark.seal", selected: "checkmark.seal.fill" }}
          md="how_to_vote"
        />
        <NativeTabs.Trigger.Label>Eleições</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ajustes">
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
