import { useState, type ReactNode } from "react";
import { Eye, EyeOff, Mail } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "./ui/utils";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md py-8">
        <Logo size="lg" className="justify-center mb-8" />
        <div className="bg-card rounded-2xl shadow-xl border border-border p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1>{title}</h1>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function IconInput({
  icon: Icon,
  error,
  className,
  type = "text",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType; error?: string }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="space-y-1">
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type={isPassword && show ? "text" : type}
          className={cn(
            "w-full pl-10 py-3 bg-input-background rounded-lg border focus:outline-none focus:ring-2 focus:ring-ring",
            isPassword ? "pr-12" : "pr-4",
            error ? "border-destructive" : "border-border",
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Stand-in for a real mailbox: shows the one-time code that would have been emailed. */
export function SimulatedInbox({ email, code, purpose }: { email: string; code: string; purpose: string }) {
  return (
    <div className="p-4 rounded-lg border border-dashed border-primary/50 bg-primary/5 text-sm space-y-1">
      <div className="flex items-center gap-2 font-medium text-primary">
        <Mail className="w-4 h-4" /> Hộp thư mô phỏng — {email}
      </div>
      <p className="text-muted-foreground">
        Mã {purpose} của bạn là <span className="font-mono font-bold text-foreground tracking-widest text-base">{code}</span> (hiệu lực 10 phút).
      </p>
    </div>
  );
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"];
  const colors = ["bg-red-500", "bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-600"];
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full", i < score ? colors[score] : "bg-secondary")} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Độ mạnh: {labels[score]}</p>
    </div>
  );
}
