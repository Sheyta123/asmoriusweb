import { useState } from "react";
import { Link } from "react-router";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Receipt } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { formatDateTime } from "../lib/format";
import { formatVND } from "../lib/pricing";
import { MIN_WITHDRAWAL, requestWithdrawal } from "../lib/api/social";
import type { TransactionType } from "../lib/types";
import { EmptyState, Modal, Spinner, btnOutline, btnPrimary, inputClass, useAction } from "../components/common";

const TX_LABELS: Record<TransactionType, string> = {
  escrow_hold: "Ký quỹ",
  escrow_release: "Giải ngân",
  platform_fee: "Phí sàn",
  refund: "Hoàn tiền",
  withdraw: "Rút tiền",
};

const W_STATUS = {
  pending: { label: "Đang xử lý", cls: "bg-amber-50 text-amber-700" },
  approved: { label: "Đã chuyển", cls: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Bị từ chối", cls: "bg-red-50 text-red-700" },
};

export function WalletPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bank" | "paypal">("bank");
  const [account, setAccount] = useState("");
  const { pending, run } = useAction();

  const { transactions, withdrawals, escrowHeld, pendingIncome } = useDb(
    (db) => ({
      transactions: db.transactions.filter((t) => t.userId === user!.id).sort((a, b) => b.createdAt - a.createdAt),
      withdrawals: db.withdrawals.filter((w) => w.userId === user!.id).sort((a, b) => b.createdAt - a.createdAt),
      escrowHeld: db.orders.filter((o) => o.customerId === user!.id && ["in_progress", "delivered", "disputed"].includes(o.status)).reduce((s, o) => s + o.total, 0),
      pendingIncome: db.orders.filter((o) => o.creatorUserId === user!.id && ["in_progress", "delivered", "disputed"].includes(o.status)).reduce((s, o) => s + Math.round(o.total * 0.9), 0),
    }),
    [user?.id],
  );

  const submit = async () => {
    const ok = await run(async () => {
      await requestWithdrawal(Number(amount), method, account);
      return true;
    }, "Đã gửi yêu cầu rút tiền. Admin sẽ xử lý trong 1-3 ngày làm việc.");
    if (ok) {
      setOpen(false);
      setAmount("");
    }
  };

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="mb-1">Ví & giao dịch</h1>
        <p className="text-muted-foreground">Số dư, tiền ký quỹ và lịch sử giao dịch của bạn</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-white space-y-3">
          <div className="flex items-center gap-2 text-white/80"><Wallet className="w-5 h-5" /> Số dư khả dụng</div>
          <div className="text-3xl font-bold">{formatVND(user!.balance)}</div>
          <button onClick={() => setOpen(true)} disabled={user!.balance < MIN_WITHDRAWAL} className="px-4 py-2 bg-white text-primary rounded-lg font-medium disabled:opacity-60">
            Rút tiền
          </button>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground"><Lock className="w-5 h-5" /> Đang ký quỹ (đơn đã đặt)</div>
          <div className="text-2xl font-bold">{formatVND(escrowHeld)}</div>
          <p className="text-xs text-muted-foreground">Giải ngân cho creator khi bạn chấp nhận sản phẩm</p>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground"><ArrowDownCircle className="w-5 h-5" /> Thu nhập chờ giải ngân</div>
          <div className="text-2xl font-bold">{formatVND(pendingIncome)}</div>
          <p className="text-xs text-muted-foreground">90% giá trị các đơn bạn đang thực hiện</p>
        </div>
      </div>

      {user!.creatorStatus !== "approved" && (
        <div className="p-4 rounded-xl bg-secondary/60 border border-border text-sm flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <span>Trở thành creator để nhận commission và rút thu nhập về ngân hàng/PayPal.</span>
          <Link to="/become-creator" className={btnPrimary}>Đăng ký creator</Link>
        </div>
      )}

      {withdrawals.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="mb-4">Yêu cầu rút tiền</h3>
          <div className="space-y-3">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{formatVND(w.amount)} → {w.method === "bank" ? "Ngân hàng" : "PayPal"}</div>
                  <div className="text-muted-foreground truncate">{w.account} · {formatDateTime(w.createdAt)}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${W_STATUS[w.status].cls}`}>{W_STATUS[w.status].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="mb-4">Lịch sử giao dịch</h3>
        {transactions.length === 0 ? (
          <EmptyState icon={Receipt} title="Chưa có giao dịch" />
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((t) => (
              <div key={t.id} className="py-3 flex items-center gap-3">
                {t.amount >= 0 ? <ArrowDownCircle className="w-8 h-8 text-emerald-600 flex-shrink-0" /> : <ArrowUpCircle className="w-8 h-8 text-rose-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{TX_LABELS[t.type]}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.note}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</div>
                </div>
                <div className={`font-semibold whitespace-nowrap ${t.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {t.amount >= 0 ? "+" : "-"}
                  {formatVND(Math.abs(t.amount))}
                </div>
                {t.orderId && (
                  <Link to={`/orders/${t.orderId}`} className="text-xs text-primary hover:underline hidden sm:block">Xem đơn</Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Rút tiền"
        size="sm"
        footer={
          <>
            <button onClick={() => setOpen(false)} className={btnOutline}>Hủy</button>
            <button onClick={submit} disabled={pending} className={btnPrimary}>
              {pending && <Spinner className="w-4 h-4" />} Gửi yêu cầu
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Số dư khả dụng: <b className="text-foreground">{formatVND(user!.balance)}</b> · Tối thiểu {formatVND(MIN_WITHDRAWAL)}</p>
          <div>
            <label className="block mb-2">Số tiền (VND)</label>
            <div className="flex gap-2">
              <input inputMode="numeric" value={amount ? Number(amount).toLocaleString("vi-VN") : ""} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="VD: 1.000.000" className={inputClass} />
              <button type="button" onClick={() => setAmount(String(user!.balance))} className={btnOutline}>Tất cả</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["bank", "paypal"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)} className={`p-3 rounded-lg border ${method === m ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>
                {m === "bank" ? "Ngân hàng" : "PayPal"}
              </button>
            ))}
          </div>
          <div>
            <label className="block mb-2">{method === "bank" ? "Ngân hàng - Số tài khoản - Chủ tài khoản" : "Email PayPal"}</label>
            <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder={method === "bank" ? "Vietcombank - 0123456789 - NGUYEN VAN A" : "you@example.com"} className={inputClass} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
