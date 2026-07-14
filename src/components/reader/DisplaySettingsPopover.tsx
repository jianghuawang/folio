import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ReadingSettings, ReadingSettingsUpdate } from "@/types/settings";

const FONT_FAMILY_OPTIONS = [
  { label: "Georgia", value: "Georgia" },
  { label: "System Sans", value: "system-ui" },
  { label: "Palatino", value: "Palatino" },
  { label: "Monospace", value: "Menlo" },
] as const;

const LINE_HEIGHT_OPTIONS = [
  { label: "Compact", value: 1.4 },
  { label: "Normal", value: 1.6 },
  { label: "Relaxed", value: 1.9 },
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

  const labelClassName = [
    "text-[11px] font-semibold uppercase tracking-[0.08em]",
    darkTheme ? "text-white/40" : "text-black/40",
  ].join(" ");

  const controlSurfaceClassName = darkTheme
    ? "border border-white/[0.08] bg-white/[0.06]"
    : "border border-black/[0.08] bg-black/[0.04]";

  const selectClassName = [
    "h-8 w-full rounded-[7px] px-2.5 text-[13px] outline-none transition-colors",
    controlSurfaceClassName,
    darkTheme
      ? "text-white focus:border-[#0a84ff]/60 [&>option]:bg-[#2c2c2e]"
      : "text-black focus:border-[#0a84ff]/60",
  ].join(" ");

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={[
          "flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-[15px] font-semibold tracking-[-0.02em] transition-colors",
          open
            ? darkTheme
              ? "bg-white/[0.14] text-white"
              : "bg-black/[0.09] text-black"
            : darkTheme
              ? "text-white/70 hover:bg-white/[0.08] hover:text-white/95"
              : "text-black/65 hover:bg-black/[0.05] hover:text-black/85",
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
          className={[
            "animate-fade-in absolute right-0 top-[calc(100%+10px)] z-30 w-[272px] rounded-[12px] border p-4 shadow-popup backdrop-blur-2xl",
            darkTheme
              ? "border-white/[0.12] bg-[#2c2c2e]/95 text-white"
              : "border-black/[0.08] bg-white/95 text-black",
          ].join(" ")}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className={labelClassName}>Font Size</p>
              <div
                className={[
                  "flex items-center justify-between rounded-[8px] px-1 py-1",
                  controlSurfaceClassName,
                ].join(" ")}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={[
                    "h-7 w-7 rounded-[6px]",
                    darkTheme
                      ? "text-white/70 hover:bg-white/[0.08] hover:text-white"
                      : "text-black/65 hover:bg-black/[0.05] hover:text-black/85",
                  ].join(" ")}
                  aria-label="Decrease font size"
                  onClick={() =>
                    onUpdate({ font_size: Math.max(12, Math.min(32, settings.font_size - 1)) })
                  }
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span
                  className={[
                    "text-[13px] font-medium tabular-nums",
                    darkTheme ? "text-white/85" : "text-black/80",
                  ].join(" ")}
                >
                  {settings.font_size} pt
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={[
                    "h-7 w-7 rounded-[6px]",
                    darkTheme
                      ? "text-white/70 hover:bg-white/[0.08] hover:text-white"
                      : "text-black/65 hover:bg-black/[0.05] hover:text-black/85",
                  ].join(" ")}
                  aria-label="Increase font size"
                  onClick={() =>
                    onUpdate({ font_size: Math.max(12, Math.min(32, settings.font_size + 1)) })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className={labelClassName}>Font</p>
              <select
                value={settings.font_family}
                onChange={(event) =>
                  onUpdate({ font_family: event.target.value as ReadingSettings["font_family"] })
                }
                className={selectClassName}
              >
                {FONT_FAMILY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <p className={labelClassName}>Line Spacing</p>
              <div className={["grid grid-cols-3 gap-0.5 rounded-[8px] p-0.5", controlSurfaceClassName].join(" ")}>
                {LINE_HEIGHT_OPTIONS.map((option) => {
                  const isActive = settings.line_height === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onUpdate({ line_height: option.value })}
                      className={[
                        "h-7 rounded-[6px] text-[12px] font-medium transition-colors",
                        isActive
                          ? darkTheme
                            ? "bg-white/[0.16] text-white shadow-sm"
                            : "bg-white text-black shadow-sm"
                          : darkTheme
                            ? "text-white/55 hover:text-white/85"
                            : "text-black/50 hover:text-black/80",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className={labelClassName}>Theme</p>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((option) => {
                  const isActive = settings.theme === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onUpdate({ theme: option.id })}
                      className={[
                        "flex h-10 items-center justify-center rounded-[8px] border text-[12px] font-medium transition-all",
                        option.bgClassName,
                        option.textClassName,
                        isActive
                          ? "border-[#0a84ff] ring-2 ring-[#0a84ff]/30"
                          : darkTheme
                            ? "border-white/[0.14]"
                            : "border-black/[0.12]",
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
