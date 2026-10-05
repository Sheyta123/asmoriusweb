import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { User, Mail, Lock, Phone } from "lucide-react";
import { AuthShell, IconInput, PasswordStrength } from "../components/AuthShell";
import { Spinner } from "../components/common";
import { useAuth } from "../context/AuthContext";
import { register, validatePassword } from "../lib/api/auth";

type Field = "fullName" | "email" | "phone" | "password" | "confirmPassword";

export function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const redirect = params.get("redirect") ?? "/";
  const [formData, setFormData] = useState<Record<Field, string>>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field | "form", string>>>({});
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (field: Field, value: string) => {
    setFormData((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
  };

  const validate = () => {
    const next: typeof errors = {};
    if (formData.fullName.trim().length < 2) next.fullName = "Vui lòng nhập họ tên";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email.trim())) next.email = "Email không hợp lệ";
    if (formData.phone && !/^(0|\+84)\d{9,10}$/.test(formData.phone.replace(/\s/g, ""))) next.phone = "Số điện thoại không hợp lệ";
    const pw = validatePassword(formData.password);
    if (pw) next.password = pw;
    if (formData.password !== formData.confirmPassword) next.confirmPassword = "Mật khẩu xác nhận không khớp";
    if (!agreed) next.form = "Bạn cần đồng ý với Điều khoản sử dụng";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { email, code } = await register({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone.replace(/\s/g, ""),
        password: formData.password,
      });
      navigate(`/verify-email?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirect)}`, { state: { code } });
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Đăng ký tài khoản" subtitle="Tham gia cộng đồng Asmorius ngay hôm nay">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label htmlFor="fullName">Họ và tên</label>
          <IconInput icon={User} id="fullName" autoComplete="name" placeholder="Nguyễn Văn A" value={formData.fullName} onChange={(e) => set("fullName", e.target.value)} error={errors.fullName} />
        </div>

        <div className="space-y-2">
          <label htmlFor="email">Email</label>
          <IconInput icon={Mail} id="email" type="email" autoComplete="email" placeholder="email@example.com" value={formData.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
        </div>

        <div className="space-y-2">
          <label htmlFor="phone">
            Số điện thoại <span className="text-muted-foreground text-sm font-normal">(không bắt buộc)</span>
          </label>
          <IconInput icon={Phone} id="phone" type="tel" autoComplete="tel" placeholder="0901 234 567" value={formData.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} />
        </div>

        <div className="space-y-2">
          <label htmlFor="password">Mật khẩu</label>
          <IconInput icon={Lock} id="password" type="password" autoComplete="new-password" placeholder="Tối thiểu 8 ký tự, gồm chữ và số" value={formData.password} onChange={(e) => set("password", e.target.value)} error={errors.password} />
          <PasswordStrength password={formData.password} />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
          <IconInput icon={Lock} id="confirmPassword" type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={formData.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} error={errors.confirmPassword} />
        </div>

        <div className="p-4 bg-secondary rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">
            Tài khoản của bạn có thể vừa là khách hàng vừa là creator. Bạn có thể nộp hồ sơ creator sau khi đăng ký.
          </p>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setErrors((x) => ({ ...x, form: undefined })); }} className="w-4 h-4 mt-1 rounded border-border accent-primary" />
          <span className="text-sm text-muted-foreground">
            Tôi đồng ý với <span className="text-primary">Điều khoản sử dụng</span> và <span className="text-primary">Chính sách bảo mật</span> của Asmorius
          </span>
        </label>

        {errors.form && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{errors.form}</p>}

        <button type="submit" disabled={loading} className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Spinner className="w-4 h-4" />}
          Đăng ký
        </button>
      </form>

      <div className="text-center">
        <span className="text-muted-foreground">Đã có tài khoản? </span>
        <Link to="/login" className="text-primary hover:underline">
          Đăng nhập ngay
        </Link>
      </div>
    </AuthShell>
  );
}
