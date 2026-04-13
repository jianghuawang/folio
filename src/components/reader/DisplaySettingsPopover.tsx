import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ReadingSettings, ReadingSettingsUpdate } from "@/types/settings";

const FONT_FAMILY_OPTIONS = [
  { label: "Georgia", value: "Georgia" },
  { label: "San Francisco", value: "system-ui" },
  { label: "Palatino", value: "Palatino" },
  { label: "Menlo", value: "Menlo" },
] as const;

const LINE_HEIGHT_OPTIONS = [
  { label: "Tight (1.4)", value: 1.4 },
  { label: "Normal (1.6)", value: 1.6 },
  { label: "Relaxed (1.9)", value: 1.9 },
] as const;

const THEME_OPTIONS = [
  { bgClassName: "bg-white", id: "light", label: "Light", textClassName: "text-black" },
  { bgClassName: "bg-[#f5f0e8]", id: "sepia", label: "Sepia", textClassName: "text-[#5c4738]" },
  { bgClassName: "bg-[#2c2c2e]", id: "dark", label: "Dark", textClassName: "text-white" },
] as const;

interface DisplaySettingsPopoverProps {
  disabled?: boolean;
  onUpdate: (settings: ReadingSettingsUpdate) => void;
  settings: ReadingSettings;
}

export function DisplaySettingsPopover({
  disabled = false,
  onUpdate,
  settings,
}: DisplaySettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const darkTheme = settings.theme === "dark";

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={[
          "flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-[15px] font-semibold tracking-[-0.02em] transition disabled:opacity-100",
          darkTheme
            ? "text-white/78 hover:bg-white/[0.07] hover:text-white/92"
            : "text-black/70 hover:bg-black/[0.05] hover:text-black/85",
        ].join(" ")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Display settings"
        title="Display settings"
      >
        Aa
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Display settings"
          className="absolute right-0 top-[calc(100%+12px)] z-30 w-[320px] rounded-[20px] border border-[#e7e2db] bg-white p-5 text-black shadow-[0_20px_50px_rgba(0,0,0,0.16)]"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
                Font Size
              </p>
              <div className="flex items-center justify-between rounded-2xl border border-[#ece7df] bg-[#f5f2ec] px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-black/70 hover:bg-black/[0.05] hover:text-black/85"
                  onClick={() =>
                    onUpdate({ font_size: Math.max(12, Math.min(32, settings.font_size - 1)) })
                  }
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium text-black/80">{settings.font_size}px</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-black/70 hover:bg-black/[0.05] hover:text-black/85"
                  onClick={() =>
                    onUpdate({ font_size: Math.max(12, Math.min(32, settings.font_size + 1)) })
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
                Font
              </p>
              <select
                value={settings.font_family}
                onChange={(event) =>
                  onUpdate({ font_family: event.target.value as ReadingSettings["font_family"] })
                }
                className="h-11 w-full rounded-2xl border border-[#ece7df] bg-[#f5f2ec] px-3 text-sm text-black outline-none transition focus:border-black/20"
              >
                {FONT_FAMILY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
                Line Height
              </p>
              <select
                value={settings.line_height}
                onChange={(event) =>
                  onUpdate({
                    line_height: Number(event.target.value) as ReadingSettings["line_height"],
                  })
                }
                className="h-11 w-full rounded-2xl border border-[#ece7df] bg-[#f5f2ec] px-3 text-sm text-black outline-none transition focus:border-black/20"
              >
                {LINE_HEIGHT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
                Theme
              </p>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((option) => {
                  const isActive = settings.theme === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onUpdate({ theme: option.id })}
                      className={[
                        "flex h-12 items-center justify-center rounded-2xl border text-sm font-medium transition",
                        option.bgClassName,
                        option.textClassName,
                        isActive
                          ? "border-[--color-primary] ring-2 ring-[--color-primary]/25"
                          : "border-black/10",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
