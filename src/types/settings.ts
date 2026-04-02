export type ReadingTheme = "light" | "sepia" | "dark";
export type ReadingFontFamily = "Georgia" | "system-ui" | "Palatino" | "Menlo";

export interface ReadingSettings {
  font_size: number;
  font_family: ReadingFontFamily;
  line_height: 1.4 | 1.6 | 1.9;
  theme: ReadingTheme;
}

export interface ReadingSettingsUpdate {
  font_size?: number;
  font_family?: ReadingFontFamily;
  line_height?: 1.4 | 1.6 | 1.9;
  theme?: ReadingTheme;
}

export interface AppSettings {
  llm_model: string;
}

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}
