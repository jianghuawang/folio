import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const PLACEHOLDER_PALETTE = [
  "#0A84FF",
  "#30D158",
  "#BF5AF2",
  "#FF9F0A",
  "#64D2FF",
];

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function hashStringToColor(value: string) {
  const hash = Array.from(value).reduce((accumulator, character) => {
    return (accumulator << 5) - accumulator + character.charCodeAt(0);
  }, 0);

  return PLACEHOLDER_PALETTE[Math.abs(hash) % PLACEHOLDER_PALETTE.length];
}
