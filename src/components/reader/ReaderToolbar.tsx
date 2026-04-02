import {
  BookMarked,
  Bookmark,
  Globe,
  LayoutPanelLeft,
  Palette,
  Type,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface ReaderToolbarProps {
  title: string;
  visible: boolean;
  onToggleToc: () => void;
}

function ToolbarIconButton({
  disabled = false,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      className="h-9 w-9 rounded-full text-[--color-text-secondary] disabled:opacity-100 hover:bg-white/10 hover:text-[--color-text-primary]"
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  );
}

export function ReaderToolbar({ title, visible, onToggleToc }: ReaderToolbarProps) {
  return (
    <div
      className={[
        "relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-[--color-border] bg-[--color-bg-window] px-4 sm:px-6",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center gap-3 transition-opacity duration-200 ease-out",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center rounded-full border border-[--color-border] bg-white/[0.04] p-1 shadow-sm">
          <ToolbarIconButton
            icon={<LayoutPanelLeft className="h-4 w-4" />}
            label="TOC"
            onClick={onToggleToc}
          />
          <ToolbarIconButton disabled icon={<Palette className="h-4 w-4" />} label="Theme" />
          <ToolbarIconButton
            disabled
            icon={<BookMarked className="h-4 w-4" />}
            label="Annotations"
          />
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 px-4 text-center text-[13px] font-light tracking-[0.01em] text-[--color-text-muted]">
        {title}
      </div>

      <div
        className={[
          "flex items-center gap-3 transition-opacity duration-200 ease-out",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center rounded-full border border-[--color-border] bg-white/[0.04] p-1 shadow-sm">
          <ToolbarIconButton disabled icon={<Type className="h-4 w-4" />} label="Aa" />
          <ToolbarIconButton disabled icon={<Globe className="h-4 w-4" />} label="Translate" />
          <ToolbarIconButton disabled icon={<Bookmark className="h-4 w-4" />} label="Notes" />
        </div>
      </div>
    </div>
  );
}
