import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  X,
  MessageSquare,
  Download,
  Upload,
  ShieldAlert,
  Star,
  PencilLine,
  Lock,
  CreditCard,
  FileQuestion,
  Scale,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { formatDate, formatDateTime, timeAgo } from "../lib/format";
import { applyWatermark, downloadDataUrl, fileToDataUrl } from "../lib/images";
import { BODY_LABELS, FORMAT_LABELS, MAX_FREE_REVISIONS, PLATFORM_FEE_RATE, formatVND } from "../lib/pricing";
import {
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  acceptOrder,
  approveOrder,
  cancelOrder,
  deliverOrder,
  getCleanFile,
  openDispute,
  payOrder,
  rejectOrder,
  requestRevision,
  resolveDispute,
  reviewOrder,
  submitDraft,
} from "../lib/api/orders";
import type { Order, PaymentMethod } from "../lib/types";
import {
  Avatar,
  EmptyState,
  ImagePicker,
  Modal,
  OrderStatusBadge,
  Spinner,
  WatermarkedImage,
  btnDanger,
  btnOutline,
  btnPrimary,
  inputClass,
  useAction,
} from "../components/common";

const STEPS = ["Gửi yêu cầu", "Chốt đơn", "Ký quỹ", "Thực hiện", "Bàn giao", "Hoàn thành"];

function stepIndex(order: Order) {
  switch (order.status) {
    case "pending":
      return 0;
    case "accepted":
      return 1;
    case "in_progress":
      return order.drafts.length > 0 ? 3 : 2;
    case "delivered":
    case "disputed":
      return 4;
    case "completed":
    case "refunded":
      return 5;
    default:
      return 0;
  }
}

type ModalKind = null | "pay" | "accept" | "reject" | "draft" | "deliver" | "revision" | "dispute" | "approve" | "review" | "resolve";

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [modal, setModal] = useState<ModalKind>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const data = useDb(
    (db) => {
      const order = db.orders.find((o) => o.id === id);
      if (!order) return null;
      const customer = db.users.find((u) => u.id === order.customerId);
      const creatorUser = db.users.find((u) => u.id === order.creatorUserId);
      const creator = db.creators.find((c) => c.id === order.creatorId);
      const names = Object.fromEntries(db.users.map((u) => [u.id, u.fullName]));
      return { order: { ...order }, customer, creatorUser, creator, names };
    },
    [id],
  );

  if (!data || !user) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-16">
        <EmptyState icon={FileQuestion} title="Không tìm thấy đơn hàng" action={<Link to="/orders" className={btnPrimary}>Về danh sách đơn</Link>} />
      </div>
    );
  }

  const { order, customer, creatorUser, creator, names } = data;
  const isCustomer = user.id === order.customerId;
  const isCreator = user.id === order.creatorUserId;
  if (!isCustomer && !isCreator && !isAdmin) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-16">
        <EmptyState icon={Lock} title="Bạn không có quyền xem đơn hàng này" action={<Link to="/orders" className={btnPrimary}>Về danh sách đơn</Link>} />
      </div>
    );
  }

  const counterpart = isCustomer ? creatorUser : customer;
  const step = stepIndex(order);
  const terminal = ["rejected", "cancelled"].includes(order.status);
  const fee = Math.round(order.total * PLATFORM_FEE_RATE);

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" />
        Quay lại
      </button>

      <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
        <div className="p-6 bg-gradient-to-br from-primary/10 to-purple-600/10 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Đơn {order.code} · Tạo lúc {formatDateTime(order.createdAt)}
            </p>
            <h1 className="mt-1">{order.title}</h1>
          </div>
          <OrderStatusBadge status={order.status} className="text-sm px-3 py-1 self-start sm:self-center" />
        </div>

        {!terminal && (
          <div className="px-6 py-5 overflow-x-auto">
            <ol className="flex items-center min-w-[560px]">
              {STEPS.map((label, i) => {
                const done = i < step || (i === step && ["completed", "refunded"].includes(order.status));
                const current = i === step && !done;
                return (
                  <li key={label} className="flex-1 flex items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          done ? "bg-primary text-primary-foreground" : current ? "bg-primary/15 text-primary ring-2 ring-primary" : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {done ? <Check className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className={`text-xs whitespace-nowrap ${current ? "text-primary font-medium" : "text-muted-foreground"}`}>{label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 mb-5 ${i < step ? "bg-primary" : "bg-secondary"}`} />}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ActionPanel order={order} isCustomer={isCustomer} isCreator={isCreator} isAdmin={isAdmin} openModal={setModal} />

          {order.delivery && (
            <Section title="Sản phẩm hoàn thiện">
              {order.status === "completed" && (isCustomer || isCreator || isAdmin) ? (
                <CleanFile order={order} />
              ) : (
                <div className="space-y-3">
                  <WatermarkedImage src={order.delivery.preview} alt="Bản xem trước" className="w-full max-h-[520px] aspect-square rounded-lg border border-border" />
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Bản xem trước có watermark. File sạch chất lượng cao được mở khóa sau khi khách hàng chấp nhận sản phẩm.
                  </p>
                </div>
              )}
              {order.delivery.note && <p className="mt-3 text-sm p-3 bg-secondary rounded-lg">💬 {order.delivery.note}</p>}
            </Section>
          )}

          {order.drafts.length > 0 && (
            <Section title={`Bản nháp (${order.drafts.length})`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {order.drafts.map((d, i) => (
                  <button key={i} onClick={() => setPreview(d.image)} className="text-left group">
                    <img src={d.image} alt={`Bản nháp ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border border-border group-hover:opacity-90" />
                    <p className="text-xs text-muted-foreground mt-1 truncate">{d.note || `Bản nháp ${i + 1}`}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(d.at)}</p>
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Brief & yêu cầu">
            <div className="space-y-4 text-sm">
              <Field label="Brief">{order.brief}</Field>
              {order.details && <Field label="Chi tiết">{order.details}</Field>}
              {order.colorNotes && <Field label="Màu sắc">{order.colorNotes}</Field>}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Info label="Format" value={FORMAT_LABELS[order.options.format]} />
                <Info label="Phần vẽ" value={BODY_LABELS[order.options.bodyType].split(" ")[0]!} />
                <Info label="Thêm nhân vật" value={String(order.options.extraCharacters)} />
                <Info label="Background" value={order.options.background ? "Có" : "Không"} />
              </div>
              <Info label="Deadline mong muốn" value={formatDate(order.deadline)} />
              {order.references.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2">Ảnh tham khảo</p>
                  <div className="flex flex-wrap gap-2">
                    {order.references.map((r, i) => (
                      <button key={i} onClick={() => setPreview(r)}>
                        <img src={r} alt={`Tham khảo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-border" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {order.dispute && (
            <Section title="Khiếu nại">
              <div className="space-y-2 text-sm">
                <Field label={`Lý do (${formatDateTime(order.dispute.at)})`}>{order.dispute.reason}</Field>
                {order.dispute.resolvedAt ? (
                  <Field label={`Kết quả xử lý (${formatDateTime(order.dispute.resolvedAt)})`}>{order.dispute.resolution}</Field>
                ) : (
                  <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Đang chờ Admin xử lý. Tiền ký quỹ được giữ nguyên cho đến khi có kết quả.</p>
                )}
              </div>
            </Section>
          )}

          <Section title="Lịch sử đơn hàng">
            <ol className="relative border-l border-border ml-2 space-y-4">
              {[...order.events].reverse().map((e, i) => (
                <li key={i} className="ml-4">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary/70 mt-1.5" />
                  <p className="text-sm">{e.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(e.at)}
                    {e.by !== "system" && names[e.by] ? ` · ${names[e.by]}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Các bên">
            <div className="space-y-4">
              {[
                { role: "Khách hàng", u: customer, link: undefined as string | undefined },
                { role: "Creator", u: creatorUser, link: creator ? `/creator/${creator.id}` : undefined },
              ].map(({ role, u, link }) => (
                <div key={role} className="flex items-center gap-3">
                  <Avatar src={u?.avatar} name={u?.fullName ?? role} className="w-11 h-11" />
                  <div className="flex-1 min-w-0">
                    {link ? (
                      <Link to={link} className="font-medium hover:underline truncate block">{creator?.name ?? u?.fullName}</Link>
                    ) : (
                      <div className="font-medium truncate">{u?.fullName}</div>
                    )}
                    <div className="text-xs text-muted-foreground">{role}</div>
                  </div>
                </div>
              ))}
              {counterpart && (isCustomer || isCreator) && (
                <Link to={`/messages?with=${counterpart.id}`} className={`${btnOutline} w-full`}>
                  <MessageSquare className="w-4 h-4" /> Chat với {isCustomer ? "creator" : "khách hàng"}
                </Link>
              )}
            </div>
          </Section>

          <Section title="Thanh toán">
            <div className="space-y-3 text-sm">
              <Row label="Tổng giá trị" value={<span className="text-lg font-bold text-primary">{formatVND(order.total)}</span>} />
              {(isCreator || isAdmin) && (
                <>
                  <Row label={`Phí sàn (${PLATFORM_FEE_RATE * 100}%)`} value={`-${formatVND(fee)}`} />
                  <Row label="Creator nhận" value={<span className="font-semibold">{formatVND(order.total - fee)}</span>} />
                </>
              )}
              <div className="pt-3 border-t border-border">
                {order.payment ? (
                  <div className="space-y-1">
                    <Row label="Phương thức" value={PAYMENT_LABELS[order.payment.method]} />
                    <Row label="Ký quỹ lúc" value={formatDateTime(order.payment.paidAt)} />
                    <p className={`mt-2 text-xs rounded-lg p-2 ${order.status === "completed" ? "bg-emerald-50 text-emerald-700" : order.status === "refunded" ? "bg-gray-100 text-gray-700" : "bg-blue-50 text-blue-700"}`}>
                      {order.status === "completed" ? "✅ Đã giải ngân cho creator" : order.status === "refunded" ? "↩️ Đã hoàn tiền cho khách hàng" : "🔒 Tiền đang được giữ tại ví ký quỹ"}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Chưa thanh toán ký quỹ</p>
                )}
              </div>
            </div>
          </Section>

          {order.review && (
            <Section title="Đánh giá">
              <div className="flex mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={`w-5 h-5 ${i <= order.review!.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                ))}
              </div>
              {order.review.comment && <p className="text-sm">{order.review.comment}</p>}
            </Section>
          )}

          {order.rejectReason && (
            <Section title="Lý do từ chối">
              <p className="text-sm">{order.rejectReason}</p>
            </Section>
          )}
        </div>
      </div>

      <OrderModals order={order} modal={modal} onClose={() => setModal(null)} />
      <Modal open={!!preview} onClose={() => setPreview(null)} title="Xem ảnh" size="xl">
        {preview && <img src={preview} alt="Xem ảnh" className="w-full max-h-[70vh] object-contain" />}
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="p-3 bg-secondary rounded-lg whitespace-pre-line">{children}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-secondary rounded-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function CleanFile({ order }: { order: Order }) {
  const { run } = useAction();
  return (
    <div className="space-y-3">
      <img src={order.delivery!.preview} alt="Sản phẩm" className="w-full max-h-[520px] object-contain rounded-lg border border-border bg-secondary" />
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
        <span className="text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> File sạch đã được mở khóa
        </span>
        <button
          onClick={() =>
            run(() => {
              const file = getCleanFile(order);
              downloadDataUrl(file.dataUrl, file.name);
            })
          }
          className={btnPrimary}
        >
          <Download className="w-4 h-4" /> Tải file sạch
        </button>
      </div>
    </div>
  );
}

function ActionPanel({
  order,
  isCustomer,
  isCreator,
  isAdmin,
  openModal,
}: {
  order: Order;
  isCustomer: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  openModal: (m: ModalKind) => void;
}) {
  const { pending, run } = useAction();
  let message: React.ReactNode = null;
  const actions: React.ReactNode[] = [];

  if (isCustomer) {
    switch (order.status) {
      case "pending":
        message = "Yêu cầu đã được gửi. Creator sẽ xem brief và phản hồi — bạn có thể trao đổi thêm qua chat trong lúc chờ.";
        actions.push(
          <button key="cancel" disabled={pending} onClick={() => confirm("Hủy yêu cầu này?") && run(() => cancelOrder(order.id), "Đã hủy yêu cầu")} className={btnOutline}>
            Hủy yêu cầu
          </button>,
        );
        break;
      case "accepted":
        message = <>Creator đã chốt đơn với giá <b>{formatVND(order.total)}</b>. Thanh toán ký quỹ để creator bắt đầu thực hiện. Tiền chỉ được giải ngân khi bạn chấp nhận sản phẩm.</>;
        actions.push(
          <button key="pay" onClick={() => openModal("pay")} className={btnPrimary}>
            <CreditCard className="w-4 h-4" /> Thanh toán ký quỹ
          </button>,
          <button key="cancel" disabled={pending} onClick={() => confirm("Hủy đơn này?") && run(() => cancelOrder(order.id), "Đã hủy đơn")} className={btnOutline}>
            Hủy đơn
          </button>,
        );
        break;
      case "in_progress":
        message = "Creator đang thực hiện tác phẩm. Bản nháp sẽ được gửi qua chat và hiển thị bên dưới.";
        actions.push(
          <button key="dispute" onClick={() => openModal("dispute")} className={btnDanger}>
            <ShieldAlert className="w-4 h-4" /> Khiếu nại
          </button>,
        );
        break;
      case "delivered":
        message = (
          <>
            Creator đã bàn giao sản phẩm. Nếu hài lòng, bấm <b>Chấp nhận</b> để mở khóa file sạch. Còn {MAX_FREE_REVISIONS - order.revisionCount}/{MAX_FREE_REVISIONS} lần chỉnh sửa miễn phí.
          </>
        );
        actions.push(
          <button key="approve" onClick={() => openModal("approve")} className={btnPrimary}>
            <Check className="w-4 h-4" /> Chấp nhận sản phẩm
          </button>,
          <button key="revise" disabled={order.revisionCount >= MAX_FREE_REVISIONS} onClick={() => openModal("revision")} className={btnOutline}>
            <PencilLine className="w-4 h-4" /> Yêu cầu chỉnh sửa
          </button>,
          <button key="dispute" onClick={() => openModal("dispute")} className={btnDanger}>
            <ShieldAlert className="w-4 h-4" /> Khiếu nại
          </button>,
        );
        break;
      case "completed":
        message = order.review ? "Cảm ơn bạn đã sử dụng Asmorius! 💜" : "Đơn hàng hoàn thành! Hãy để lại đánh giá để giúp cộng đồng tìm được creator phù hợp.";
        if (!order.review)
          actions.push(
            <button key="review" onClick={() => openModal("review")} className={btnPrimary}>
              <Star className="w-4 h-4" /> Đánh giá creator
            </button>,
          );
        break;
    }
  } else if (isCreator) {
    switch (order.status) {
      case "pending":
        message = "Khách hàng đã gửi yêu cầu. Xem brief, deadline, ngân sách và trao đổi qua chat trước khi chốt đơn.";
        actions.push(
          <button key="accept" onClick={() => openModal("accept")} className={btnPrimary}>
            <Check className="w-4 h-4" /> Chốt đơn
          </button>,
          <button key="reject" onClick={() => openModal("reject")} className={btnDanger}>
            <X className="w-4 h-4" /> Từ chối
          </button>,
        );
        break;
      case "accepted":
        message = "Đã chốt đơn. Đang chờ khách hàng thanh toán ký quỹ — hệ thống sẽ thông báo khi tiền được giữ thành công.";
        actions.push(
          <button key="reject" onClick={() => openModal("reject")} className={btnOutline}>
            Hủy nhận đơn
          </button>,
        );
        break;
      case "in_progress":
        message = (
          <>
            🔒 Khách hàng đã ký quỹ {formatVND(order.total)}. Hãy gửi bản nháp để khách duyệt, sau đó bàn giao file hoàn thiện (hệ thống tự phủ watermark).
            {order.revisionCount > 0 && <> Khách hàng đã yêu cầu chỉnh sửa {order.revisionCount} lần.</>}
          </>
        );
        actions.push(
          <button key="draft" onClick={() => openModal("draft")} className={btnOutline}>
            <Upload className="w-4 h-4" /> Gửi bản nháp
          </button>,
          <button key="deliver" onClick={() => openModal("deliver")} className={btnPrimary}>
            <Upload className="w-4 h-4" /> Bàn giao file hoàn thiện
          </button>,
        );
        break;
      case "delivered":
        message = "Đã bàn giao. Đang chờ khách hàng chấp nhận để giải ngân.";
        break;
      case "completed":
        message = `Đơn hoàn thành — ${formatVND(order.total - Math.round(order.total * PLATFORM_FEE_RATE))} đã được cộng vào ví của bạn.`;
        actions.push(
          <Link key="wallet" to="/wallet" className={btnOutline}>
            Xem ví
          </Link>,
        );
        break;
    }
  }

  if (order.status === "disputed") {
    message = isAdmin ? "Đơn đang khiếu nại. Xem brief, lịch sử chat và bản bàn giao để ra quyết định." : "Đơn đang được Admin xem xét khiếu nại.";
    if (isAdmin)
      actions.push(
        <button key="resolve" onClick={() => openModal("resolve")} className={btnPrimary}>
          <Scale className="w-4 h-4" /> Xử lý khiếu nại
        </button>,
      );
  }
  if (order.status === "rejected") message = "Creator đã từ chối yêu cầu này. Bạn có thể tìm creator khác phù hợp hơn.";
  if (order.status === "cancelled") message = "Yêu cầu đã bị hủy.";
  if (order.status === "refunded") message = "Khiếu nại đã được xử lý: tiền ký quỹ đã được hoàn cho khách hàng.";

  if (!message && actions.length === 0) return null;
  return (
    <div className="bg-card rounded-2xl border-2 border-primary/30 p-6 space-y-4">
      {message && <p>{message}</p>}
      {actions.length > 0 && <div className="flex flex-wrap gap-3">{actions}</div>}
      {order.status === "rejected" && isCustomer && (
        <Link to="/find-creators" className={btnPrimary}>Tìm creator khác</Link>
      )}
    </div>
  );
}

function OrderModals({ order, modal, onClose }: { order: Order; modal: ModalKind; onClose: () => void }) {
  const { pending, run } = useAction();
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [clean, setClean] = useState<{ url: string; name: string } | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("momo");
  const [price, setPrice] = useState(String(order.total));
  const [rating, setRating] = useState(5);
  const [outcome, setOutcome] = useState<"refund" | "release">("refund");

  const close = () => {
    setText("");
    setImage("");
    setClean(null);
    onClose();
  };
  const exec = async (fn: () => Promise<unknown>, msg: string) => {
    const ok = await run(async () => {
      await fn();
      return true;
    }, msg);
    if (ok) close();
  };

  const handleFinalFile = async (file: File | undefined) => {
    if (!file) return;
    await run(async () => {
      const url = await fileToDataUrl(file, 2400, 0.92);
      setClean({ url, name: file.name });
      setImage(await applyWatermark(url));
    });
  };

  const footer = (label: string, onConfirm: () => void, disabled = false, danger = false) => (
    <>
      <button onClick={close} className={btnOutline}>Hủy</button>
      <button onClick={onConfirm} disabled={pending || disabled} className={danger ? btnDanger : btnPrimary}>
        {pending && <Spinner className="w-4 h-4" />}
        {label}
      </button>
    </>
  );

  switch (modal) {
    case "pay":
      return (
        <Modal open onClose={close} title="Thanh toán ký quỹ (Escrow)" size="sm" footer={footer(pending ? "Đang xử lý..." : `Thanh toán ${formatVND(order.total)}`, () => exec(() => payOrder(order.id, method), "Thanh toán ký quỹ thành công!"))}>
          <div className="space-y-4">
            <div className="p-4 bg-secondary rounded-lg flex justify-between">
              <span className="text-muted-foreground">Số tiền ký quỹ</span>
              <span className="font-bold text-primary">{formatVND(order.total)}</span>
            </div>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((m) => (
                <label key={m.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${method === m.value ? "border-primary bg-primary/5" : "border-border"}`}>
                  <input type="radio" name="method" checked={method === m.value} onChange={() => setMethod(m.value)} className="accent-primary" />
                  <div>
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.hint}</div>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Đây là cổng thanh toán mô phỏng — không có giao dịch thật nào được thực hiện. Tiền được giữ tại ví trung gian của Asmorius cho đến khi bạn chấp nhận sản phẩm.
            </p>
          </div>
        </Modal>
      );
    case "accept":
      return (
        <Modal open onClose={close} title="Chốt đơn" size="sm" footer={footer("Chốt đơn", () => exec(() => acceptOrder(order.id, Number(price.replace(/\D/g, ""))), "Đã chốt đơn! Chờ khách hàng ký quỹ."))}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Giá dự kiến theo bảng giá là {formatVND(order.total)}. Bạn có thể điều chỉnh sau khi đã thống nhất với khách qua chat.</p>
            <label className="block">Giá chốt (VND)</label>
            <input inputMode="numeric" value={Number(price.replace(/\D/g, "") || 0).toLocaleString("vi-VN")} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} className={inputClass} />
          </div>
        </Modal>
      );
    case "reject":
      return (
        <Modal open onClose={close} title="Từ chối đơn hàng" size="sm" footer={footer("Từ chối", () => exec(() => rejectOrder(order.id, text), "Đã từ chối đơn"), false, true)}>
          <label className="block mb-2">Lý do (khách hàng sẽ nhận được)</label>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="VD: Hiện mình đang quá tải / Brief chưa phù hợp với style của mình..." className={`${inputClass} resize-none`} />
        </Modal>
      );
    case "draft":
      return (
        <Modal open onClose={close} title="Gửi bản nháp (Sketch/Draft)" size="sm" footer={footer("Gửi bản nháp", () => exec(() => submitDraft(order.id, image, text), "Đã gửi bản nháp"), !image)}>
          <div className="space-y-4">
            {image ? <img src={image} alt="Bản nháp" className="w-full rounded-lg border border-border" /> : null}
            <ImagePicker onPick={([u]) => setImage(u!)} className={`${btnOutline} w-full`}>
              <Upload className="w-4 h-4" /> {image ? "Chọn ảnh khác" : "Chọn ảnh bản nháp"}
            </ImagePicker>
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ghi chú cho khách hàng..." className={`${inputClass} resize-none`} />
          </div>
        </Modal>
      );
    case "deliver":
      return (
        <Modal
          open
          onClose={close}
          title="Bàn giao file hoàn thiện"
          footer={footer("Bàn giao", () => exec(() => deliverOrder(order.id, { preview: image, clean: clean!.url, fileName: clean!.name, note: text }), "Đã bàn giao sản phẩm"), !clean || !image)}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tải lên file chất lượng cao. Hệ thống sẽ tự động phủ watermark lên bản xem trước — khách hàng chỉ nhận file sạch sau khi chấp nhận sản phẩm.
            </p>
            <label className={`${btnOutline} w-full cursor-pointer`}>
              <Upload className="w-4 h-4" /> {clean ? `Đã chọn: ${clean.name}` : "Chọn file hoàn thiện"}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => handleFinalFile(e.target.files?.[0])} />
            </label>
            {pending && !image && (
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Spinner className="w-4 h-4" /> Đang phủ watermark...</p>
            )}
            {image && (
              <div>
                <p className="text-sm font-medium mb-2">Bản xem trước khách hàng sẽ thấy:</p>
                <img src={image} alt="Preview có watermark" className="w-full rounded-lg border border-border" />
              </div>
            )}
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Lời nhắn khi bàn giao..." className={`${inputClass} resize-none`} />
          </div>
        </Modal>
      );
    case "revision":
      return (
        <Modal open onClose={close} title="Yêu cầu chỉnh sửa" size="sm" footer={footer("Gửi yêu cầu", () => exec(() => requestRevision(order.id, text), "Đã gửi yêu cầu chỉnh sửa"))}>
          <p className="text-sm text-muted-foreground mb-3">Còn {MAX_FREE_REVISIONS - order.revisionCount} lần chỉnh sửa miễn phí.</p>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Mô tả cụ thể điểm cần chỉnh sửa..." className={`${inputClass} resize-none`} />
        </Modal>
      );
    case "dispute":
      return (
        <Modal open onClose={close} title="Khiếu nại đơn hàng" size="sm" footer={footer("Gửi khiếu nại", () => exec(() => openDispute(order.id, text), "Đã gửi khiếu nại. Admin sẽ xử lý sớm."), false, true)}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Đội ngũ Admin sẽ xem xét dựa trên lịch sử chat và brief để quyết định hoàn tiền hoặc giải ngân. Tiền ký quỹ được giữ nguyên trong thời gian xử lý.
            </p>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Mô tả vấn đề: sai lệch brief, trễ deadline, creator không phản hồi..." className={`${inputClass} resize-none`} />
          </div>
        </Modal>
      );
    case "approve":
      return (
        <Modal open onClose={close} title="Chấp nhận sản phẩm" size="sm" footer={footer("Chấp nhận & mở khóa file", () => exec(() => approveOrder(order.id), "Đã chấp nhận! File sạch đã được mở khóa."))}>
          <p>
            Xác nhận bạn hài lòng với sản phẩm? Tiền ký quỹ <b>{formatVND(order.total)}</b> sẽ được giải ngân cho creator và bạn có thể tải file sạch chất lượng cao. Thao tác này không thể hoàn tác.
          </p>
        </Modal>
      );
    case "review":
      return (
        <Modal open onClose={close} title="Đánh giá creator" size="sm" footer={footer("Gửi đánh giá", () => exec(() => reviewOrder(order.id, rating, text), "Cảm ơn bạn đã đánh giá!"))}>
          <div className="space-y-4">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setRating(i)} aria-label={`${i} sao`}>
                  <Star className={`w-9 h-9 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Chia sẻ trải nghiệm của bạn..." className={`${inputClass} resize-none`} />
          </div>
        </Modal>
      );
    case "resolve":
      return (
        <Modal open onClose={close} title="Xử lý khiếu nại" size="sm" footer={footer("Xác nhận", () => exec(() => resolveDispute(order.id, outcome, text), "Đã xử lý khiếu nại"))}>
          <div className="space-y-3">
            <p className="text-sm p-3 bg-secondary rounded-lg">“{order.dispute?.reason}”</p>
            {(["refund", "release"] as const).map((o) => (
              <label key={o} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${outcome === o ? "border-primary bg-primary/5" : "border-border"}`}>
                <input type="radio" checked={outcome === o} onChange={() => setOutcome(o)} className="accent-primary" />
                <span>{o === "refund" ? `Hoàn ${formatVND(order.total)} cho khách hàng` : "Giải ngân cho creator (trừ phí sàn)"}</span>
              </label>
            ))}
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ghi chú kết quả xử lý (gửi tới cả hai bên)..." className={`${inputClass} resize-none`} />
          </div>
        </Modal>
      );
    default:
      return null;
  }
}
