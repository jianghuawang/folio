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
      className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-3 sm:px-6"
    >
      <div
        className={[
          "pointer-events-none absolute left-4 top-3 flex items-center gap-3 transition-opacity duration-200 ease-out sm:left-6",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center rounded-full border border-white/10 bg-black/35 p-1 shadow-popup backdrop-blur-md">
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

      <div className="pointer-events-none absolute left-1/2 top-7 -translate-x-1/2 px-4 text-center text-[13px] font-light tracking-[0.01em] text-[--color-text-muted]">
        {title}
      </div>

      <div
        className={[
          "pointer-events-none absolute right-4 top-3 flex items-center gap-3 transition-opacity duration-200 ease-out sm:right-6",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center rounded-full border border-white/10 bg-black/35 p-1 shadow-popup backdrop-blur-md">
          <ToolbarIconButton disabled icon={<Type className="h-4 w-4" />} label="Aa" />
          <ToolbarIconButton disabled icon={<Globe className="h-4 w-4" />} label="Translate" />
          <ToolbarIconButton disabled icon={<Bookmark className="h-4 w-4" />} label="Notes" />
        </div>
      </div>
    </div>
  );
}
