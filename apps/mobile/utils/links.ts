import * as WebBrowser from "expo-web-browser"

/** Abre uma fonte oficial no navegador do app, sem tirar a pessoa dele. */
export const openUrl = (url: string) => void WebBrowser.openBrowserAsync(url)
