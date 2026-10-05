export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function conversationIdOf(a: string, b: string) {
  return [a, b].sort().join("__");
}

export function orderCode(n: number) {
  return `ASM-${String(n).padStart(5, "0")}`;
}
