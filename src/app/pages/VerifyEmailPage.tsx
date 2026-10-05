import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthShell, SimulatedInbox } from "../components/AuthShell";
import { Spinner } from "../components/common";
import { resendVerification, verifyEmail } from "../lib/api/auth";

const RESEND_COOLDOWN = 30;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const redirect = params.get("redirect") ?? "/";
  const [sentCode, setSentCode] = useState<string>((location.state as { code?: string } | null)?.code ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(sentCode ? RESEND_COOLDOWN : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!email) {
    return (
      <AuthShell title="Xác thực email">
        <p className="text-center text-muted-foreground">Liên kết không hợp lệ.</p>
        <Link to="/register" className="block text-center text-primary hover:underline">Quay lại đăng ký</Link>
      </AuthShell>
    );
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyEmail(email, code);
      toast.success("Xác thực thành công! Vui lòng đăng nhập.");
      navigate(`/login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirect)}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const newCode = await resendVerification(email);
      setSentCode(newCode);
      setCooldown(RESEND_COOLDOWN);
      toast.success("Đã gửi lại mã xác thực");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <AuthShell title="Xác thực email" subtitle="Bước cuối cùng để kích hoạt tài khoản">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <MailCheck className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          Chúng tôi đã gửi mã gồm 6 chữ số tới <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      {sentCode && <SimulatedInbox email={email} code={sentCode} purpose="xác thực" />}

      <form onSubmit={handleVerify} className="space-y-4">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            setError("");
          }}
          placeholder="______"
          aria-label="Mã xác thực"
          className="w-full text-center text-2xl font-mono tracking-[0.6em] py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <button type="submit" disabled={code.length !== 6 || loading} className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Spinner className="w-4 h-4" />}
          Xác thực
        </button>
      </form>

      <div className="text-center text-sm">
        <span className="text-muted-foreground">Chưa nhận được mã? </span>
        <button onClick={handleResend} disabled={cooldown > 0} className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
          {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : "Gửi lại mã"}
        </button>
      </div>
    </AuthShell>
  );
}
