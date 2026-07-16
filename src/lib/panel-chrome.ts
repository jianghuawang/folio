import type { ReadingTheme } from "@/types/settings";

/**
 * Single source of truth for the unified floating-chrome design language
 * (TECH_DESIGN.md Section 4a "Floating panel chrome"). Every helper returns a
 * complete literal class string per theme so Tailwind's JIT scanner sees all
 * classes; never build class names by interpolation.
 */

export type ChromeTheme = "light" | "dark";

/** Sepia intentionally maps to the light chrome variant — matches
 *  ReaderToolbar / DisplaySettingsPopover / PageChevrons / ProgressBar. */
export function resolveChromeTheme(theme: ReadingTheme): ChromeTheme {
  return theme === "dark" ? "dark" : "light";
}

/** z-index ladder for floating surfaces. */
export const Z = {
  toolbar: "z-20",
  banner: "z-30",
  panel: "z-40",
  modal: "z-50",
  selection: "z-[60]",
  popup: "z-[70]",
} as const;

/** The one sanctioned off-scale radius: controls nested inside an 8px
 *  container with ~2px padding (segmented triggers, menu items, options). */
export const NESTED_RADIUS = "rounded-[6px]";

/** Entrance treatment for anchored panels (TECH_DESIGN 4f: fade + slight
 *  scale, 160ms). Apply to the wrapper, never the positioned element. */
export const panelAnimation = "animate-panel-in origin-top";
export const panelAnimationTopLeft = "animate-panel-in origin-top-left";

/** Glass panel card — anchored dropdowns, note editor, Ask AI, menus. */
export function panelSurface(theme: ChromeTheme): string {
  return theme === "dark"
    ? "rounded-lg border border-white/[0.12] bg-[#2c2c2e]/95 text-white shadow-popup backdrop-blur-2xl"
    : "rounded-lg border border-black/[0.08] bg-white/95 text-black shadow-panel backdrop-blur-2xl";
}

/** Pointer notch; border/background must exactly match panelSurface. */
export function panelNotch(theme: ChromeTheme): string {
  return theme === "dark"
    ? "absolute top-0 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-white/[0.12] bg-[#2c2c2e]/95"
    : "absolute top-0 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-black/[0.08] bg-white/95";
}

/** Pill bar — reader toolbar, selection popup, translation banner. */
export function barSurface(theme: ChromeTheme): string {
  return theme === "dark"
    ? "rounded-full border border-white/[0.09] bg-[#28282a]/85 shadow-[0_0.5px_0_rgba(255,255,255,0.08)_inset,0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl"
    : "rounded-full border border-black/[0.06] bg-white/85 shadow-[0_0.5px_0_rgba(255,255,255,0.7)_inset,0_10px_30px_rgba(0,0,0,0.1)] backdrop-blur-xl";
}

/** Modal card — the same language at the 20px modal radius. */
export function modalSurface(theme: ChromeTheme): string {
  return theme === "dark"
    ? "rounded-xl border border-white/[0.12] bg-[#2c2c2e]/95 text-white shadow-popup backdrop-blur-2xl"
    : "rounded-xl border border-black/[0.08] bg-white/90 text-black shadow-panel backdrop-blur-2xl";
}

export function modalOverlay(theme: ChromeTheme): string {
  return theme === "dark"
    ? "bg-black/20 backdrop-blur-[10px]"
    : "bg-white/[0.04] backdrop-blur-[10px]";
}

/** Section heading inside panels. */
export function panelHeading(theme: ChromeTheme): string {
  return theme === "dark"
    ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40"
    : "text-[11px] font-semibold uppercase tracking-[0.08em] text-black/40";
}

/** Default body text inside panels. */
export function panelBody(theme: ChromeTheme): string {
  return theme === "dark"
    ? "text-[13px] leading-5 text-white/85"
    : "text-[13px] leading-5 text-black/80";
}

/** The one muted text value. */
export function panelMuted(theme: ChromeTheme): string {
  return theme === "dark" ? "text-[13px] text-white/45" : "text-[13px] text-black/45";
}

/** Horizontal or vertical divider fill (pair with h-px / h-6 w-px). */
export function divider(theme: ChromeTheme): string {
  return theme === "dark" ? "bg-white/[0.14]" : "bg-black/10";
}

/** Ghost button text + hover fill. */
export function ghostControl(theme: ChromeTheme): string {
  return theme === "dark"
    ? "text-white/70 transition hover:bg-white/[0.08] hover:text-white/95"
    : "text-black/65 transition hover:bg-black/[0.05] hover:text-black/85";
}

/** Secondary control fill — segmented containers, tab lists, cancel buttons. */
export function controlSurface(theme: ChromeTheme): string {
  return theme === "dark"
    ? "border border-white/[0.08] bg-white/[0.06]"
    : "border border-black/[0.08] bg-black/[0.04]";
}

/** Inline error box. */
export function errorBox(theme: ChromeTheme): string {
  return theme === "dark"
    ? "rounded-md border border-[#ff453a]/25 bg-[#ff453a]/10 text-[#ff7b72]"
    : "rounded-md border border-[#ff3b3026] bg-[#ff3b3010] text-[#c53929]";
}

/** Input / textarea surface inside panels. */
export function inputSurface(theme: ChromeTheme): string {
  return theme === "dark"
    ? "rounded-md border-white/[0.12] bg-white/[0.06] text-white placeholder:text-white/35"
    : "rounded-md border-black/10 bg-white/75 text-black placeholder:text-black/35";
}

/** List-row hover/active fills (TOC items, annotation rows). */
export function listRowHover(theme: ChromeTheme): string {
  return theme === "dark" ? "hover:bg-white/[0.07]" : "hover:bg-black/[0.05]";
}

export function listRowActive(theme: ChromeTheme): string {
  return theme === "dark" ? "bg-white/[0.1] text-white" : "bg-black/[0.07] text-black";
}
