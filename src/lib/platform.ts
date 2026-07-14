/**
 * True when running inside the macOS webview. Window chrome differs per
 * platform: macOS windows use an overlay title bar (traffic lights float over
 * the content), so layouts must reserve space for them and mark drag regions.
 */
export const isMacOS = navigator.userAgent.includes("Mac");
