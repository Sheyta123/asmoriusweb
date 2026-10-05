import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { Sparkles, ShieldCheck, Clock, ImagePlus, X, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { defaultPriceList, submitApplication } from "../lib/api/social";
import type { PriceList } from "../lib/types";
import { ImagePicker, Spinner, btnPrimary, inputClass, useAction } from "../components/common";
import { PriceListEditor, TagPicker } from "../components/CreatorFields";

export function BecomeCreatorPage() {
  const { user, creator, isAdmin } = useAuth();
  const navigate = useNavigate();
  const previous = useDb((db) => [...db.applications].reverse().find((a) => a.userId === user!.id), [user?.id]);
  const [form, setForm] = useState({
    displayName: previous?.displayName ?? user!.fullName,
    type: (previous?.type ?? "Artist") as "Artist" | "Writer",
    specialty: previous?.specialty ?? "",
    bio: previous?.bio ?? "",
    portfolioUrl: previous?.portfolioUrl ?? "",
    legalName: previous?.legalName ?? user!.fullName,
    idNumber: previous?.idNumber ?? "",
  });
  const [tags, setTags] = useState<string[]>(previous?.tags ?? []);
  const [samples, setSamples] = useState<string[]>(previous?.samples ?? []);
  const [priceList, setPriceList] = useState<PriceList>(previous?.priceList ?? defaultPriceList());
  const [agreed, setAgreed] = useState(false);
  const { pending, run } = useAction();

  if (creator) return <Navigate to={`/creator/${creator.id}`} replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  if (user!.creatorStatus === "pending") {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="w-10 h-10 text-amber-600" />
        </div>
        <h1>Hồ sơ đang được kiểm duyệt</h1>
        <p className="text-muted-foreground">
          Cảm ơn bạn đã đăng ký! Đội ngũ Asmorius sẽ kiểm duyệt thủ công portfolio và thông tin định danh (KYC). Bạn sẽ nhận thông báo ngay khi có kết quả.
        </p>
        <Link to="/profile" className={btnPrimary}>Về trang cá nhân</Link>
      </div>
    );
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      await submitApplication({ ...form, tags, samples, priceList });
      return true;
    }, "Đã nộp hồ sơ! Chúng tôi sẽ phản hồi sớm nhất.");
    if (ok) navigate("/profile");
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-600/10 border border-border">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-8 h-8 text-primary" />
          <h1>Trở thành Creator</h1>
        </div>
        <p className="text-muted-foreground mb-4">Nộp hồ sơ năng lực để mở cửa hàng trên Asmorius. Bạn nhận 90% giá trị mỗi đơn — tiền đã được ký quỹ trước khi bạn bắt đầu.</p>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          {["Nộp portfolio & thông tin định danh", "Admin kiểm duyệt thủ công (KYC)", "Kích hoạt cửa hàng & bảng giá"].map((s, i) => (
            <div key={s} className="flex items-center gap-2 p-3 rounded-lg bg-card">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{i + 1}</span>
              {s}
            </div>
          ))}
        </div>
      </div>

      {user!.creatorStatus === "rejected" && previous?.adminNote && (
        <div className="mb-6 p-4 rounded-xl border border-destructive/40 bg-destructive/5 text-sm">
          <b>Hồ sơ trước chưa đạt:</b> {previous.adminNote}. Vui lòng bổ sung và nộp lại.
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2>1. Thông tin cửa hàng</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Tên hiển thị *</label>
              <input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block mb-2">Bạn là *</label>
              <div className="grid grid-cols-2 gap-2">
                {(["Artist", "Writer"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => set("type", t)} className={`py-2.5 rounded-lg border ${form.type === t ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>
                    {t === "Artist" ? "🎨 Artist" : "✍️ Writer"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block mb-2">Chuyên môn *</label>
            <input value={form.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="VD: Dark Fantasy Illustration, OC Story Writing..." className={inputClass} required />
          </div>
          <div>
            <label className="block mb-2">Giới thiệu</label>
            <textarea rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Kinh nghiệm, phong cách, những gì bạn nhận và không nhận..." className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className="block mb-2">Tag phong cách *</label>
            <TagPicker value={tags} onChange={setTags} />
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2>2. Hồ sơ năng lực</h2>
          <div>
            <label className="block mb-2">Link portfolio</label>
            <input type="url" value={form.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} placeholder="https://www.artstation.com/..." className={inputClass} />
          </div>
          <div>
            <label className="block mb-2">Tác phẩm mẫu (tối đa 6)</label>
            <div className="flex flex-wrap gap-3">
              {samples.map((s, i) => (
                <div key={i} className="relative">
                  <img src={s} alt={`Mẫu ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border border-border" />
                  <button type="button" onClick={() => setSamples(samples.filter((_, j) => j !== i))} aria-label="Xóa" className="absolute -top-2 -right-2 p-0.5 bg-destructive text-white rounded-full">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {samples.length < 6 && (
                <ImagePicker multiple maxSize={1200} onPick={(u) => setSamples([...samples, ...u].slice(0, 6))} className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary">
                  <ImagePlus className="w-6 h-6" />
                </ImagePicker>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Cần link portfolio hoặc ít nhất 1 tác phẩm mẫu.</p>
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="flex items-center gap-2">3. Thông tin định danh <ShieldCheck className="w-5 h-5 text-primary" /></h2>
          <p className="text-sm text-muted-foreground">Chỉ đội ngũ kiểm duyệt nhìn thấy. Dùng để xác minh danh tính và bảo vệ khách hàng.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Họ tên theo CCCD *</label>
              <input value={form.legalName} onChange={(e) => set("legalName", e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block mb-2">Số CCCD/CMND *</label>
              <input inputMode="numeric" value={form.idNumber} onChange={(e) => set("idNumber", e.target.value.replace(/\D/g, ""))} maxLength={12} className={inputClass} required />
            </div>
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2>4. Bảng giá (Price List)</h2>
          <p className="text-sm text-muted-foreground">Giá đơn = Format + Phần vẽ + Yêu cầu khác. Bạn có thể chỉnh sửa bất cứ lúc nào sau khi được duyệt.</p>
          <PriceListEditor value={priceList} onChange={setPriceList} />
        </section>

        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-4 h-4 mt-1 accent-primary" />
          <span className="text-sm text-muted-foreground">Tôi cam kết tác phẩm là của mình, đồng ý mức phí sàn 10% và quy định bàn giao qua hệ thống (watermark, ký quỹ).</span>
        </label>

        <button type="submit" disabled={pending || !agreed} className={`${btnPrimary} w-full py-3`}>
          {pending ? <Spinner className="w-4 h-4" /> : <CheckCircle2 className="w-5 h-5" />}
          Nộp hồ sơ
        </button>
      </form>
    </div>
  );
}
