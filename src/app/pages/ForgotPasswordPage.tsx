import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Mail, Lock, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { AuthShell, IconInput, PasswordStrength, SimulatedInbox } from "../components/AuthShell";
import { Spinner } from "../components/common";
import { requestPasswordReset, resetPassword } from "../lib/api/auth";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      setSentCode(await requestPasswordReset(email));
      setStep("reset");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, code, password);
      toast.success("Đặt lại mật khẩu thành công! Vui lòng đăng nhập.");
      navigate(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Quên mật khẩu" subtitle={step === "email" ? "Nhập email để nhận mã đặt lại mật khẩu" : "Nhập mã và mật khẩu mới"}>
      {step === "email" ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email">Email</label>
            <IconInput icon={Mail} id="email" type="email" autoComplete="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading || !email} className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Spinner className="w-4 h-4" />}
            Gửi mã
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          <SimulatedInbox email={email} code={sentCode} purpose="đặt lại mật khẩu" />
          <div className="space-y-2">
            <label htmlFor="code">Mã xác thực</label>
            <IconInput icon={KeyRound} id="code" inputMode="numeric" maxLength={6} placeholder="6 chữ số" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
          </div>
          <div className="space-y-2">
            <label htmlFor="password">Mật khẩu mới</label>
            <IconInput icon={Lock} id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <PasswordStrength password={password} />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm">Xác nhận mật khẩu mới</label>
            <IconInput icon={Lock} id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading || code.length !== 6 || !password} className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Spinner className="w-4 h-4" />}
            Đặt lại mật khẩu
          </button>
        </form>
      )}
      <div className="text-center">
        <Link to="/login" className="text-primary hover:underline text-sm">
          ← Quay lại đăng nhập
        </Link>
      </div>
    </AuthShell>
  );
}
