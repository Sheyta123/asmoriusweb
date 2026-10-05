import { useState } from "react";
import { useNavigate } from "react-router";
import { ImagePlus, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createOrder } from "../lib/api/orders";
import { BODY_LABELS, FORMAT_LABELS, computeTotal, formatVND } from "../lib/pricing";
import type { Creator, OrderOptions } from "../lib/types";
import { ImagePicker, Modal, Spinner, btnOutline, btnPrimary, inputClass } from "./common";

function minDeadline() {
  const d = new Date(Date.now() + 3 * 24 * 3600_000);
  return d.toISOString().slice(0, 10);
}

export function TermsModal({ creator, open, onClose, onAccept }: { creator: Creator; open: boolean; onClose: () => void; onAccept?: () => void }) {
  const p = creator.priceList;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Term of Service — ${creator.name}`}
      footer={
        onAccept && (
          <>
            <button onClick={onClose} className={btnOutline}>Hủy</button>
            <button onClick={onAccept} className={btnPrimary}>Đồng ý và tiếp tục</button>
          </>
        )
      }
    >
      <div className="space-y-6 text-sm">
        <div>
          <h3 className="mb-3">Bảng giá dịch vụ</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-secondary/60 space-y-1">
              <h4 className="font-semibold mb-1">Format</h4>
              {(Object.keys(FORMAT_LABELS) as OrderOptions["format"][]).map((k) => (
                <div key={k} className="flex justify-between gap-2"><span>{FORMAT_LABELS[k]}</span><span className="font-medium">{formatVND(p[k])}</span></div>
              ))}
            </div>
            <div className="p-4 rounded-lg bg-secondary/60 space-y-1">
              <h4 className="font-semibold mb-1">Phần vẽ</h4>
              {(Object.keys(BODY_LABELS) as OrderOptions["bodyType"][]).map((k) => (
                <div key={k} className="flex justify-between gap-2"><span>{BODY_LABELS[k].split(" ")[0]}</span><span className="font-medium">{formatVND(p[k])}</span></div>
              ))}
            </div>
            <div className="p-4 rounded-lg bg-secondary/60 space-y-1">
              <h4 className="font-semibold mb-1">Yêu cầu khác</h4>
              <div className="flex justify-between gap-2"><span>Thêm nhân vật</span><span className="font-medium">+{formatVND(p.extraCharacter)}</span></div>
              <div className="flex justify-between gap-2"><span>Background</span><span className="font-medium">+{formatVND(p.background)}</span></div>
            </div>
          </div>
          <p className="text-muted-foreground mt-2">Giá cuối = Format + Phần vẽ + Yêu cầu khác. Creator có thể điều chỉnh khi chốt đơn sau khi trao đổi.</p>
        </div>
        <div>
          <h3 className="mb-2">Điều khoản</h3>
          <ul className="list-disc pl-5 space-y-1.5">
            {creator.terms.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="p-4 rounded-lg bg-primary/10 text-foreground">
          🔒 <span className="font-medium">Ký quỹ Asmorius:</span> tiền của bạn được giữ tại ví trung gian và chỉ giải ngân cho creator khi bạn bấm “Chấp nhận sản phẩm”. Nếu có tranh chấp, Admin sẽ xử lý dựa trên lịch sử chat và brief.
        </div>
      </div>
    </Modal>
  );
}

export function CommissionFormModal({ creator, open, onClose }: { creator: Creator; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [details, setDetails] = useState("");
  const [colorNotes, setColorNotes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [references, setReferences] = useState<string[]>([]);
  const [options, setOptions] = useState<OrderOptions>({ format: "fullColor", bodyType: "halfBody", extraCharacters: 0, background: false });
  const [submitting, setSubmitting] = useState(false);
  const p = creator.priceList;
  const total = computeTotal(p, options);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const order = await createOrder({ creatorId: creator.id, title, brief, details, colorNotes, deadline, references, options });
      toast.success("Đã gửi yêu cầu! Creator sẽ xem xét và phản hồi qua chat.");
      onClose();
      navigate(`/orders/${order.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const optionRow = (name: string, checked: boolean, onChange: () => void, label: string, price: number) => (
    <label key={label} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${checked ? "border-primary bg-primary/5" : "border-transparent bg-secondary hover:bg-secondary/80"}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="w-4 h-4 accent-primary" />
      <span className="flex-1">{label}</span>
      <span className="text-primary font-semibold text-sm">{formatVND(price)}</span>
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Đặt Commission từ ${creator.name}`}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block mb-2">Tiêu đề commission *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Character Design cho OC của tôi" className={inputClass} required minLength={3} />
        </div>
        <div>
          <label className="block mb-2">Brief — mô tả ý tưởng *</label>
          <textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Nhân vật/cặp đôi/plot là gì? Tính cách, bối cảnh, cảm xúc muốn truyền tải..." className={`${inputClass} resize-none`} required minLength={10} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2">Chi tiết</label>
            <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tư thế, trang phục, phụ kiện, góc nhìn..." className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className="block mb-2">Màu sắc</label>
            <textarea rows={3} value={colorNotes} onChange={(e) => setColorNotes(e.target.value)} placeholder="Tông màu chủ đạo, mã màu tóc/mắt..." className={`${inputClass} resize-none`} />
          </div>
        </div>
        <div>
          <label className="block mb-2">Ảnh tham khảo (tối đa 4)</label>
          <div className="flex flex-wrap gap-3">
            {references.map((r, i) => (
              <div key={i} className="relative">
                <img src={r} alt={`Tham khảo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-border" />
                <button type="button" onClick={() => setReferences(references.filter((_, j) => j !== i))} aria-label="Xóa ảnh" className="absolute -top-2 -right-2 p-0.5 bg-destructive text-white rounded-full">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {references.length < 4 && (
              <ImagePicker multiple maxSize={1200} onPick={(urls) => setReferences([...references, ...urls].slice(0, 4))} className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary">
                <ImagePlus className="w-6 h-6" />
              </ImagePicker>
            )}
          </div>
        </div>
        <div>
          <label className="block mb-2">Deadline mong muốn *</label>
          <input type="date" min={minDeadline()} value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} required />
        </div>

        <div>
          <label className="block mb-2 font-semibold">Format</label>
          <div className="space-y-2">
            {(Object.keys(FORMAT_LABELS) as OrderOptions["format"][]).map((k) =>
              optionRow("format", options.format === k, () => setOptions({ ...options, format: k }), FORMAT_LABELS[k], p[k]),
            )}
          </div>
        </div>
        <div>
          <label className="block mb-2 font-semibold">Phần vẽ</label>
          <div className="space-y-2">
            {(Object.keys(BODY_LABELS) as OrderOptions["bodyType"][]).map((k) =>
              optionRow("bodyType", options.bodyType === k, () => setOptions({ ...options, bodyType: k }), BODY_LABELS[k], p[k]),
            )}
          </div>
        </div>
        <div>
          <label className="block mb-2 font-semibold">Yêu cầu khác</label>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
              <span className="flex-1">Thêm nhân vật <span className="text-sm text-muted-foreground">(+{formatVND(p.extraCharacter)}/nhân vật)</span></span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Bớt" onClick={() => setOptions({ ...options, extraCharacters: Math.max(0, options.extraCharacters - 1) })} className="p-1 rounded bg-card border border-border"><Minus className="w-4 h-4" /></button>
                <span className="w-6 text-center font-semibold">{options.extraCharacters}</span>
                <button type="button" aria-label="Thêm" onClick={() => setOptions({ ...options, extraCharacters: Math.min(5, options.extraCharacters + 1) })} className="p-1 rounded bg-card border border-border"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <label className="flex items-center gap-3 p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80">
              <input type="checkbox" checked={options.background} onChange={(e) => setOptions({ ...options, background: e.target.checked })} className="w-4 h-4 accent-primary" />
              <span className="flex-1">Kèm background</span>
              <span className="text-primary font-semibold text-sm">+{formatVND(p.background)}</span>
            </label>
          </div>
        </div>

        <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary flex justify-between items-center gap-4">
          <div>
            <div className="font-semibold">Tổng giá dự kiến</div>
            <div className="text-xs text-muted-foreground">Chỉ thanh toán ký quỹ sau khi creator chốt đơn</div>
          </div>
          <span className="text-xl sm:text-2xl font-bold text-primary whitespace-nowrap">{formatVND(total)}</span>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={`${btnOutline} flex-1`}>Hủy</button>
          <button type="submit" disabled={submitting} className={`${btnPrimary} flex-1`}>
            {submitting && <Spinner className="w-4 h-4" />}
            Gửi yêu cầu
          </button>
        </div>
      </form>
    </Modal>
  );
}
