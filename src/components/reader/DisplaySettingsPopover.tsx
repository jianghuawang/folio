import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { ReaderSelect } from "@/components/reader/ReaderSelect";
import { Button } from "@/components/ui/button";
import {
  controlSurface,
  ghostControl,
  NESTED_RADIUS,
  panelHeading,
  panelNotch,
  panelSurface,
  resolveChromeTheme,
  Z,
} from "@/lib/panel-chrome";
import type { ReadingSettings, ReadingSettingsUpdate } from "@/types/settings";

const FONT_FAMILY_OPTIONS = [
  { className: "font-[Georgia]", label: "Georgia", value: "Georgia" },
  { className: "[font-family:system-ui]", label: "System Sans", value: "system-ui" },
  { className: "[font-family:Palatino]", label: "Palatino", value: "Palatino" },
  { className: "font-[Menlo]", label: "Monospace", value: "Menlo" },
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
  const chromeTheme = resolveChromeTheme(settings.theme);
  const darkTheme = chromeTheme === "dark";

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  const labelClassName = panelHeading(chromeTheme);
  const controlSurfaceClassName = controlSurface(chromeTheme);
  const segmentedButtonClassName = `h-7 w-7 ${NESTED_RADIUS} ${ghostControl(chromeTheme)}`;

  return (
    <div className="relative">
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
        <>
          {/* Full-screen scrim: the reading area is an iframe, so document-level
              mousedown listeners never see clicks inside it. */}
          <div
            className={`fixed inset-0 ${Z.panel}`}
            onMouseDown={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Display settings"
            className={`animate-panel-in origin-top-right absolute right-0 top-[calc(100%+10px)] ${Z.panel} w-[272px] p-4 ${panelSurface(chromeTheme)}`}
          >
          <div
            className={panelNotch(chromeTheme)}
            style={{ left: "calc(100% - 18px)" }}
          />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className={labelClassName}>Font Size</p>
              <div
                className={[
                  "flex items-center justify-between rounded-md px-1 py-1",
                  controlSurfaceClassName,
                ].join(" ")}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={segmentedButtonClassName}
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
                  className={segmentedButtonClassName}
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
              <ReaderSelect
                ariaLabel="Font"
                darkTheme={darkTheme}
                options={FONT_FAMILY_OPTIONS}
                value={settings.font_family}
                onChange={(fontFamily) =>
                  onUpdate({ font_family: fontFamily as ReadingSettings["font_family"] })
                }
              />
            </div>

            <div className="space-y-1.5">
              <p className={labelClassName}>Line Spacing</p>
              <div className={["grid grid-cols-3 gap-0.5 rounded-md p-0.5", controlSurfaceClassName].join(" ")}>
                {LINE_HEIGHT_OPTIONS.map((option) => {
                  const isActive = settings.line_height === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onUpdate({ line_height: option.value })}
                      className={[
                        `h-7 ${NESTED_RADIUS} text-[12px] font-medium transition-colors`,
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
                        "flex h-10 items-center justify-center rounded-md border text-[12px] font-medium transition-all",
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
        </>
      ) : null}
    </div>
  );
}
