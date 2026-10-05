import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { initials } from "../lib/format";
import { fileToDataUrl } from "../lib/images";
import type { OrderStatus } from "../lib/types";
import { cn } from "./ui/utils";

export function Avatar({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (!src || failed) {
    return (
      <div
        className={cn(
          "rounded-full bg-gradient-to-br from-primary to-purple-600 text-white flex items-center justify-center font-semibold flex-shrink-0 select-none",
          className,
        )}
        aria-label={name}
      >
        <span className="text-[0.8em]">{initials(name) || "?"}</span>
      </div>
    );
  }
  return <img src={src} alt={name} onError={() => setFailed(true)} className={cn("rounded-full object-cover flex-shrink-0", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("w-5 h-5 animate-spin", className)} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cn("bg-card rounded-t-2xl sm:rounded-2xl w-full max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl", width)}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Đóng" className="p-2 -mr-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

/** Hidden file input wrapped in a trigger; resolves uploads to compressed data URLs. */
export function ImagePicker({
  onPick,
  children,
  multiple = false,
  maxSize = 1600,
  className,
  disabled,
}: {
  onPick: (urls: string[]) => void;
  children?: ReactNode;
  multiple?: boolean;
  maxSize?: number;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls = await Promise.all(Array.from(files).map((f) => fileToDataUrl(f, maxSize)));
      onPick(urls);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple={multiple} hidden onChange={(e) => handle(e.target.files)} />
      <button type="button" disabled={disabled || busy} onClick={() => ref.current?.click()} className={className}>
        {busy ? <Spinner className="w-4 h-4" /> : (children ?? <ImagePlus className="w-5 h-5" />)}
      </button>
    </>
  );
}

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: React.ElementType; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-14 px-4 space-y-3">
      <div className="w-16 h-16 mx-auto bg-secondary rounded-full flex items-center justify-center">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3>{title}</h3>
      {description && <p className="text-muted-foreground text-sm max-w-md mx-auto">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: "Chờ creator xác nhận", className: "bg-amber-50 text-amber-700 border-amber-200" },
  accepted: { label: "Chờ ký quỹ", className: "bg-sky-50 text-sky-700 border-sky-200" },
  in_progress: { label: "Đang thực hiện", className: "bg-blue-50 text-blue-700 border-blue-200" },
  delivered: { label: "Chờ nghiệm thu", className: "bg-violet-50 text-violet-700 border-violet-200" },
  completed: { label: "Hoàn thành", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  disputed: { label: "Đang khiếu nại", className: "bg-red-50 text-red-700 border-red-200" },
  refunded: { label: "Đã hoàn tiền", className: "bg-gray-100 text-gray-700 border-gray-200" },
  rejected: { label: "Bị từ chối", className: "bg-gray-100 text-gray-600 border-gray-200" },
  cancelled: { label: "Đã hủy", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = ORDER_STATUS[status];
  return <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap", meta.className, className)}>{meta.label}</span>;
}

/** Overlay that keeps the watermark visible even for remote preview images. */
export function WatermarkedImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden select-none", className)} onContextMenu={(e) => e.preventDefault()}>
      <img src={src} alt={alt} draggable={false} className="w-full h-full object-contain bg-secondary" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='140'><text x='0' y='80' transform='rotate(-25 130 70)' font-family='sans-serif' font-size='22' font-weight='700' fill='white' fill-opacity='0.35' stroke='black' stroke-opacity='0.12'>ASMORIUS PREVIEW</text></svg>\")",
        }}
      />
    </div>
  );
}

export const inputClass =
  "w-full px-4 py-2.5 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnOutline =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 border-2 border-destructive text-destructive rounded-lg hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/** Runs an async action with loading state and toast-based error reporting. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const run = async <T,>(fn: () => Promise<T> | T, success?: string): Promise<T | undefined> => {
    setPending(true);
    try {
      const result = await fn();
      if (success) toast.success(success);
      return result;
    } catch (e) {
      toast.error((e as Error).message || "Đã có lỗi xảy ra");
      return undefined;
    } finally {
      setPending(false);
    }
  };
  return { pending, run };
}
