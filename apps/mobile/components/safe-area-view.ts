import { SafeAreaView as SafeAreaViewBase } from "react-native-safe-area-context"
import { withUniwind } from "uniwind"

// O uniwind só intercepta className dos componentes do core do React Native.
// O SafeAreaView do react-native-safe-area-context precisa ser adaptado à mão,
// senão o className é descartado em silêncio (tela some no iOS).
export const SafeAreaView = withUniwind(SafeAreaViewBase)
