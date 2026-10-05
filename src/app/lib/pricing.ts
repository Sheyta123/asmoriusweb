import type { OrderOptions, PriceList } from "./types";

export const PLATFORM_FEE_RATE = 0.1;
export const MAX_FREE_REVISIONS = 3;

export const FORMAT_LABELS: Record<OrderOptions["format"], string> = {
  sketch: "Sketch",
  baseColor: "Base-color",
  fullColor: "Full-color",
};

export const BODY_LABELS: Record<OrderOptions["bodyType"], string> = {
  shot: "Shot (bust-up/headshot)",
  halfBody: "Half-body",
  fullBody: "Full-body",
};

export const PRICE_TIERS = [
  { value: "all", label: "Tất cả mức giá" },
  { value: "low", label: "Dưới 1.000.000 VND" },
  { value: "mid", label: "1.000.000 - 5.000.000 VND" },
  { value: "high", label: "Trên 5.000.000 VND" },
] as const;

export type PriceTier = (typeof PRICE_TIERS)[number]["value"];

export function computeTotal(p: PriceList, o: OrderOptions) {
  return (
    p[o.format] +
    p[o.bodyType] +
    p.extraCharacter * Math.max(0, o.extraCharacters) +
    (o.background ? p.background : 0)
  );
}

export function startingPrice(p: PriceList) {
  return Math.min(p.sketch, p.baseColor, p.fullColor) + Math.min(p.shot, p.halfBody, p.fullBody);
}

export function maxPrice(p: PriceList) {
  return Math.max(p.sketch, p.baseColor, p.fullColor) + Math.max(p.shot, p.halfBody, p.fullBody) + p.background;
}

export function priceTierOf(p: PriceList): Exclude<PriceTier, "all"> {
  const start = startingPrice(p);
  if (start < 1_000_000) return "low";
  if (start <= 5_000_000) return "mid";
  return "high";
}

export function formatVND(n: number) {
  return `${Math.round(n).toLocaleString("vi-VN")} VND`;
}

export function priceRangeLabel(p: PriceList) {
  return `${formatVND(startingPrice(p))} - ${formatVND(maxPrice(p))}`;
}

export function emptyPriceList(): PriceList {
  return {
    sketch: 0,
    baseColor: 0,
    fullColor: 0,
    shot: 0,
    halfBody: 0,
    fullBody: 0,
    extraCharacter: 0,
    background: 0,
  };
}
