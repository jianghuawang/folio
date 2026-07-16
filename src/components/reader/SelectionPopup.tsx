import { FileImage, Pencil, Sparkles, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

import {
  barSurface,
  divider,
  ghostControl,
  resolveChromeTheme,
  Z,
} from "@/lib/panel-chrome";
import type { HighlightColor } from "@/types/annotation";
import type { ReadingTheme } from "@/types/settings";

const HIGHLIGHT_COLORS: HighlightColor[] = [
  "#FFD60A",
  "#30D158",
  "#0A84FF",
  "#FF375F",
  "#BF5AF2",
];

const HIGHLIGHT_COLOR_CLASS_NAMES: Record<HighlightColor, string> = {
  "#FFD60A": "bg-[#FFD60A]",
  "#30D158": "bg-[#30D158]",
  "#0A84FF": "bg-[#0A84FF]",
  "#FF375F": "bg-[#FF375F]",
  "#BF5AF2": "bg-[#BF5AF2]",
};

interface SelectionPopupProps {
  activeColor?: HighlightColor | null;
  onAskAi?: () => void;
  onColorSelect: (color: HighlightColor) => void;
  onOpenNote: () => void;
  onOpenQuote: () => void;
  onRemoveHighlight?: () => void;
  showAskAi?: boolean;
  position: {
    left: number;
    top: number;
  };
  showRemoveHighlight?: boolean;
  theme?: ReadingTheme;
  visible: boolean;
}

export function SelectionPopup({
  activeColor = null,
  onAskAi,
  onColorSelect,
  onOpenNote,
  onOpenQuote,
  onRemoveHighlight,
  position,
  showAskAi = false,
  showRemoveHighlight = false,
  theme = "light",
  visible,
}: SelectionPopupProps) {
  if (!visible) {
    return null;
  }

  const chromeTheme = resolveChromeTheme(theme);
  const actionButtonClassName = `inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium ${ghostControl(chromeTheme)}`;
  const dividerClassName = `h-6 w-px ${divider(chromeTheme)}`;
  const activeSwatchClassName =
    chromeTheme === "dark" ? "scale-110 border-white/70" : "scale-110 border-black/50";
  const removeButtonClassName =
    chromeTheme === "dark"
      ? "text-white/70 transition hover:bg-white/[0.08] hover:text-[--color-destructive]"
      : "text-black/65 transition hover:bg-black/[0.05] hover:text-[--color-destructive]";

  const popup = (
    <div
      data-folio-selection-popup="true"
      className={`fixed ${Z.selection}`}
      style={{
        left: position.left,
        top: Math.max(24, position.top - 72),
        transform: "translateX(-50%)",
      }}
    >
      <div
        className={`animate-panel-in flex items-center gap-3 px-3 py-2 ${barSurface(chromeTheme)}`}
      >
        <div className="flex items-center gap-2 pr-1">
          {HIGHLIGHT_COLORS.map((color) => {
            const isActive = activeColor === color;

            return (
              <button
                key={color}
                type="button"
                onClick={() => onColorSelect(color)}
                className={[
                  "h-6 w-6 rounded-full border-2 transition",
                  HIGHLIGHT_COLOR_CLASS_NAMES[color],
                  isActive ? activeSwatchClassName : "border-white/80 hover:scale-105",
                ].join(" ")}
                aria-label={`Highlight with ${color}`}
              />
            );
          })}
        </div>

        <div className={dividerClassName} />

        <button
          type="button"
          onClick={onOpenNote}
          className={actionButtonClassName}
        >
          <Pencil className="h-4 w-4" />
          <span>Note</span>
        </button>

        {showAskAi && onAskAi ? (
          <>
            <div className={dividerClassName} />

            <button
              type="button"
              onClick={onAskAi}
              className={actionButtonClassName}
            >
              <Sparkles className="h-4 w-4" />
              <span>Ask AI</span>
            </button>
          </>
        ) : null}

        <div className={dividerClassName} />

        <button
          type="button"
          onClick={onOpenQuote}
          className={`inline-flex h-8 items-center justify-center rounded-full px-3 ${ghostControl(chromeTheme)}`}
          aria-label="Create quote cover"
        >
          <FileImage className="h-4 w-4" />
        </button>

        {showRemoveHighlight && onRemoveHighlight ? (
          <>
            <div className={dividerClassName} />

            <button
              type="button"
              onClick={onRemoveHighlight}
              className={`inline-flex h-8 items-center justify-center rounded-full px-3 ${removeButtonClassName}`}
              aria-label="Remove highlight"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
