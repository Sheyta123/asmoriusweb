import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Mail, Lock, Info } from "lucide-react";
import { toast } from "sonner";
import { AuthShell, IconInput } from "../components/AuthShell";
import { Spinner } from "../components/common";
import { useAuth } from "../context/AuthContext";
import { login } from "../lib/api/auth";
import { DEMO_ACCOUNTS } from "../lib/seed";

const DEMO_LIST = [
  { label: "Khách hàng", ...DEMO_ACCOUNTS.customer },
  { label: "Creator", ...DEMO_ACCOUNTS.creator },
  { label: "Admin", ...DEMO_ACCOUNTS.admin },
];

function safeRedirect(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const redirect = safeRedirect(params.get("redirect"));
  const [formData, setFormData] = useState({ email: params.get("email") ?? "", password: "" });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={redirect} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(formData.email, formData.password, remember);
      if (result.needsVerification) {
        toast.info("Tài khoản chưa xác thực email. Chúng tôi vừa gửi mã mới.");
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}&redirect=${encodeURIComponent(redirect)}`, { state: { code: result.code } });
        return;
      }
      toast.success(`Chào mừng trở lại, ${result.user.fullName}!`);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Đăng nhập" subtitle="Chào mừng bạn trở lại!">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label htmlFor="email">Email</label>
          <IconInput
            icon={Mail}
            id="email"
            type="email"
            autoComplete="email"
            placeholder="email@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password">Mật khẩu</label>
          <IconInput
            icon={Lock}
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
            <span className="text-sm">Ghi nhớ đăng nhập</span>
          </label>
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">
            Quên mật khẩu?
          </Link>
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={loading || !formData.email || !formData.password}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Spinner className="w-4 h-4" />}
          Đăng nhập
        </button>
      </form>

      <div className="rounded-lg bg-secondary/60 border border-border p-3 space-y-2">
        <p className="text-xs font-medium flex items-center gap-1.5 text-secondary-foreground">
          <Info className="w-3.5 h-3.5" /> Tài khoản demo (bấm để điền nhanh)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_LIST.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setFormData({ email: d.email, password: d.password })}
              className="text-xs px-2 py-1.5 rounded-md bg-card border border-border hover:border-primary hover:text-primary transition-colors"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-center">
        <span className="text-muted-foreground">Chưa có tài khoản? </span>
        <Link to={`/register${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`} className="text-primary hover:underline">
          Đăng ký ngay
        </Link>
      </div>
    </AuthShell>
  );
}
