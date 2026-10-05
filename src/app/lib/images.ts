// Image helpers: downscale uploads and burn a platform watermark into previews.

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không đọc được hình ảnh"));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Không đọc được file"));
    reader.readAsDataURL(file);
  });
}

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return "Chỉ hỗ trợ ảnh PNG, JPG, WEBP hoặc GIF";
  if (file.size > MAX_UPLOAD_BYTES) return "Ảnh tối đa 10MB";
  return null;
}

/** Reads an image file and scales it down so the longest edge is ≤ maxSize. */
export async function fileToDataUrl(file: File, maxSize = 1600, quality = 0.85): Promise<string> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);
  const raw = await readAsDataUrl(file);
  if (file.type === "image/gif") return raw;
  const img = await loadImage(raw);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", quality);
}

/** Returns a reduced-quality copy with a tiled "ASMORIUS" watermark burned in. */
export async function applyWatermark(src: string, maxSize = 1000): Promise<string> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  const fontSize = Math.max(18, Math.round(Math.min(w, h) / 14));
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.font = `700 ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const stepX = fontSize * 9;
  const stepY = fontSize * 3.2;
  const span = Math.hypot(w, h);
  for (let y = -span; y < span; y += stepY) {
    for (let x = -span; x < span; x += stepX) {
      const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.fillText("ASMORIUS • PREVIEW", x + offset, y);
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      ctx.strokeText("ASMORIUS • PREVIEW", x + offset, y);
    }
  }
  ctx.restore();
  return canvas.toDataURL("image/jpeg", 0.7);
}

export function downloadDataUrl(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
