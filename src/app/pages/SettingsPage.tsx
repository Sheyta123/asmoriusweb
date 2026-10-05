import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { User, Lock, Store, Camera, RotateCcw, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { resetDb } from "../lib/db";
import { changePassword, updateProfile } from "../lib/api/auth";
import { updateCreatorShop } from "../lib/api/social";
import { Avatar, ImagePicker, Spinner, btnDanger, btnOutline, btnPrimary, inputClass, useAction } from "../components/common";
import { PasswordStrength } from "../components/AuthShell";
import { PriceListEditor, TagPicker } from "../components/CreatorFields";

type Tab = "profile" | "security" | "shop";

export function SettingsPage() {
  const { creator } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "profile";
  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "profile", label: "Hồ sơ", icon: User },
    { key: "security", label: "Bảo mật", icon: Lock },
    ...(creator ? [{ key: "shop" as Tab, label: "Cửa hàng & bảng giá", icon: Store }] : []),
  ];

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      <h1 className="mb-6">Cài đặt tài khoản</h1>
      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <nav className="flex md:flex-col gap-2 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setParams({ tab: key })}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap text-left transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>
        <div className="bg-card rounded-2xl border border-border p-6">
          {tab === "security" ? <SecurityTab /> : tab === "shop" && creator ? <ShopTab /> : <ProfileTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const me = user!;
  const [form, setForm] = useState({ fullName: me.fullName, bio: me.bio, phone: me.phone, avatar: me.avatar });
  const { pending, run } = useAction();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateProfile(form), "Đã lưu thay đổi");
      }}
      className="space-y-5"
    >
      <h2>Thông tin cá nhân</h2>
      <div className="flex items-center gap-4">
        <Avatar src={form.avatar} name={form.fullName} className="w-20 h-20 text-2xl" />
        <div className="flex gap-2">
          <ImagePicker onPick={([u]) => setForm({ ...form, avatar: u! })} maxSize={400} className={btnOutline}>
            <Camera className="w-4 h-4" /> Đổi ảnh
          </ImagePicker>
          {form.avatar && (
            <button type="button" onClick={() => setForm({ ...form, avatar: "" })} className={btnOutline}>Gỡ ảnh</button>
          )}
        </div>
      </div>
      <div>
        <label className="block mb-2">Họ và tên</label>
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className="block mb-2">Email</label>
        <input value={me.email} disabled className={inputClass} />
      </div>
      <div>
        <label className="block mb-2">Số điện thoại</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className="block mb-2">Giới thiệu</label>
        <textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={`${inputClass} resize-none`} />
      </div>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending && <Spinner className="w-4 h-4" />} Lưu thay đổi
      </button>
    </form>
  );
}

function SecurityTab() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const { pending, run } = useAction();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirmPw) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    const ok = await run(async () => {
      await changePassword(current, next);
      return true;
    }, "Đã đổi mật khẩu");
    if (ok) {
      setCurrent("");
      setNext("");
      setConfirmPw("");
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="space-y-4 max-w-md">
        <h2>Đổi mật khẩu</h2>
        <div>
          <label className="block mb-2">Mật khẩu hiện tại</label>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className="block mb-2">Mật khẩu mới</label>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} required />
          <div className="mt-2"><PasswordStrength password={next} /></div>
        </div>
        <div>
          <label className="block mb-2">Xác nhận mật khẩu mới</label>
          <input type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputClass} required />
        </div>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending && <Spinner className="w-4 h-4" />} Cập nhật mật khẩu
        </button>
      </form>

      <div className="pt-6 border-t border-border space-y-3">
        <h3>Phiên đăng nhập</h3>
        <button
          onClick={() => {
            logout();
            toast.success("Đã đăng xuất");
            navigate("/login");
          }}
          className={btnOutline}
        >
          Đăng xuất khỏi thiết bị này
        </button>
      </div>

      <div className="pt-6 border-t border-border space-y-3">
        <h3>Dữ liệu demo</h3>
        <p className="text-sm text-muted-foreground">Bản demo lưu dữ liệu trên trình duyệt của bạn. Khôi phục sẽ xóa mọi tài khoản, đơn hàng, tin nhắn đã tạo và nạp lại dữ liệu mẫu.</p>
        <button
          onClick={async () => {
            if (!confirm("Khôi phục toàn bộ dữ liệu demo? Thao tác này không thể hoàn tác.")) return;
            logout();
            await resetDb();
            toast.success("Đã khôi phục dữ liệu demo");
            navigate("/login");
          }}
          className={btnDanger}
        >
          <RotateCcw className="w-4 h-4" /> Khôi phục dữ liệu demo
        </button>
      </div>
    </div>
  );
}

function ShopTab() {
  const { creator } = useAuth();
  const c = creator!;
  const [specialty, setSpecialty] = useState(c.specialty);
  const [bio, setBio] = useState(c.bio);
  const [tags, setTags] = useState(c.tags);
  const [priceList, setPriceList] = useState(c.priceList);
  const [isOpen, setIsOpen] = useState(c.isOpen);
  const [terms, setTerms] = useState(c.terms);
  const [newTerm, setNewTerm] = useState("");
  const { pending, run } = useAction();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateCreatorShop({ specialty, bio, tags, priceList, isOpen, terms }), "Đã cập nhật cửa hàng");
      }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h2>Cửa hàng {c.name}</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm">{isOpen ? "Đang mở đơn" : "Tạm đóng đơn"}</span>
          <button type="button" role="switch" aria-checked={isOpen} onClick={() => setIsOpen(!isOpen)} className={`w-11 h-6 rounded-full relative transition-colors ${isOpen ? "bg-primary" : "bg-switch-background"}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isOpen ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </label>
      </div>
      <div>
        <label className="block mb-2">Chuyên môn</label>
        <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block mb-2">Giới thiệu cửa hàng</label>
        <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className={`${inputClass} resize-none`} />
      </div>
      <div>
        <label className="block mb-2">Tags</label>
        <TagPicker value={tags} onChange={setTags} />
      </div>
      <div>
        <label className="block mb-2">Bảng giá</label>
        <PriceListEditor value={priceList} onChange={setPriceList} />
      </div>
      <div>
        <label className="block mb-2">Term of Service</label>
        <ul className="space-y-2 mb-2">
          {terms.map((t, i) => (
            <li key={i} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/60 text-sm">
              <span className="flex-1">{t}</span>
              <button type="button" onClick={() => setTerms(terms.filter((_, j) => j !== i))} aria-label="Xóa điều khoản" className="p-1 text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="Thêm điều khoản..." className={inputClass} />
          <button
            type="button"
            onClick={() => {
              if (newTerm.trim()) setTerms([...terms, newTerm.trim()]);
              setNewTerm("");
            }}
            className={btnOutline}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending && <Spinner className="w-4 h-4" />} Lưu cửa hàng
      </button>
    </form>
  );
}
