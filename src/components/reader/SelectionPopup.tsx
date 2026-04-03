import { FileImage, Pencil } from "lucide-react";
import { createPortal } from "react-dom";

import type { HighlightColor } from "@/types/annotation";

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
  onColorSelect: (color: HighlightColor) => void;
  onOpenNote: () => void;
  onOpenQuote: () => void;
  position: {
    left: number;
    top: number;
  };
  visible: boolean;
}

export function SelectionPopup({
  activeColor = null,
  onColorSelect,
  onOpenNote,
  onOpenQuote,
  position,
  visible,
}: SelectionPopupProps) {
  if (!visible) {
    return null;
  }

  const popup = (
    <div
      data-folio-selection-popup="true"
      className="fixed z-[60]"
      style={{
        left: position.left,
        top: Math.max(24, position.top - 72),
        transform: "translateX(-50%)",
      }}
    >
      <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white/96 px-3 py-2 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl">
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
                  isActive ? "scale-110 border-black/50" : "border-white/80 hover:scale-105",
                ].join(" ")}
                aria-label={`Highlight with ${color}`}
              />
            );
          })}
        </div>

        <div className="h-6 w-px bg-black/10" />

        <button
          type="button"
          onClick={onOpenNote}
          className="inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium text-black/70 transition hover:bg-black/[0.04] hover:text-black/85"
        >
          <Pencil className="h-4 w-4" />
          <span>Note</span>
        </button>

        <div className="h-6 w-px bg-black/10" />

        <button
          type="button"
          onClick={onOpenQuote}
          className="inline-flex h-8 items-center justify-center rounded-full px-3 text-black/70 transition hover:bg-black/[0.04] hover:text-black/85"
          aria-label="Create quote cover"
        >
          <FileImage className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
