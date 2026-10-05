// Password hashing via PBKDF2 (WebCrypto). Falls back to a non-cryptographic
// hash only when SubtleCrypto is unavailable (plain-http dev on a LAN IP).

const ITERATIONS = 20000;

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    let h = 5381;
    const s = salt + password;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return "weak:" + (h >>> 0).toString(16);
  }
  const enc = new TextEncoder();
  const key = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export function generateOtp() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1000000).padStart(6, "0");
}
