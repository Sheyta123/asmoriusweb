import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ShieldCheck, Users, ClipboardList, Wallet, Scale, FileCheck2, ExternalLink, Search } from "lucide-react";
import { useDb } from "../lib/db";
import { formatDateTime } from "../lib/format";
import { formatVND, priceRangeLabel } from "../lib/pricing";
import { reviewApplication, reviewWithdrawal } from "../lib/api/social";
import type { CreatorApplication } from "../lib/types";
import { Avatar, EmptyState, Modal, OrderStatusBadge, Spinner, btnDanger, btnOutline, btnPrimary, inputClass, useAction } from "../components/common";

type Tab = "overview" | "applications" | "disputes" | "withdrawals" | "orders" | "users";

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "overview";

  const counts = useDb((db) => ({
    applications: db.applications.filter((a) => a.status === "pending").length,
    disputes: db.orders.filter((o) => o.status === "disputed").length,
    withdrawals: db.withdrawals.filter((w) => w.status === "pending").length,
  }));

  const tabs: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: "overview", label: "Tổng quan", icon: ShieldCheck },
    { key: "applications", label: "Duyệt creator", icon: FileCheck2, badge: counts.applications },
    { key: "disputes", label: "Khiếu nại", icon: Scale, badge: counts.disputes },
    { key: "withdrawals", label: "Rút tiền", icon: Wallet, badge: counts.withdrawals },
    { key: "orders", label: "Đơn hàng", icon: ClipboardList },
    { key: "users", label: "Người dùng", icon: Users },
  ];

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2">
        <ShieldCheck className="w-7 h-7 text-primary" /> Quản trị hệ thống
      </h1>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setParams({ tab: key })}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
          >
            <Icon className="w-4 h-4" /> {label}
            {!!badge && <span className="px-1.5 rounded-full bg-destructive text-white text-xs">{badge}</span>}
          </button>
        ))}
      </div>
      {tab === "applications" ? <Applications /> : tab === "disputes" ? <Disputes /> : tab === "withdrawals" ? <Withdrawals /> : tab === "orders" ? <Orders /> : tab === "users" ? <UsersTab /> : <Overview />}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="p-5 bg-card rounded-xl border border-border">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Overview() {
  const s = useDb((db) => {
    const paid = db.orders.filter((o) => o.payment);
    return {
      users: db.users.length,
      creators: db.creators.length,
      orders: db.orders.length,
      gmv: paid.reduce((sum, o) => sum + o.total, 0),
      escrow: db.orders.filter((o) => ["in_progress", "delivered", "disputed"].includes(o.status)).reduce((sum, o) => sum + o.total, 0),
      revenue: db.platformRevenue,
      byStatus: db.orders.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }), {}),
    };
  });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat label="Người dùng" value={s.users} />
        <Stat label="Creators đang hoạt động" value={s.creators} />
        <Stat label="Tổng đơn hàng" value={s.orders} />
        <Stat label="GMV (đơn đã ký quỹ)" value={formatVND(s.gmv)} />
        <Stat label="Đang giữ ký quỹ" value={formatVND(s.escrow)} hint="Tiền khách đã nạp, chưa giải ngân" />
        <Stat label="Doanh thu phí sàn" value={formatVND(s.revenue)} hint="10% mỗi đơn hoàn thành" />
      </div>
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="mb-4">Đơn hàng theo trạng thái</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(s.byStatus).map(([status, n]) => (
            <div key={status} className="flex items-center gap-2">
              <OrderStatusBadge status={status as never} />
              <span className="font-semibold">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Applications() {
  const { apps, users } = useDb((db) => ({
    apps: [...db.applications].sort((a, b) => Number(a.status !== "pending") - Number(b.status !== "pending") || b.createdAt - a.createdAt),
    users: Object.fromEntries(db.users.map((u) => [u.id, u])),
  }));
  const [selected, setSelected] = useState<CreatorApplication | null>(null);
  const [note, setNote] = useState("");
  const { pending, run } = useAction();

  const decide = async (approve: boolean) => {
    if (!selected) return;
    const ok = await run(async () => {
      await reviewApplication(selected.id, approve, note);
      return true;
    }, approve ? "Đã duyệt và kích hoạt cửa hàng creator" : "Đã từ chối hồ sơ");
    if (ok) {
      setSelected(null);
      setNote("");
    }
  };

  if (apps.length === 0) return <EmptyState icon={FileCheck2} title="Chưa có hồ sơ nào" />;
  return (
    <>
      <div className="space-y-3">
        {apps.map((a) => (
          <div key={a.id} className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar src={users[a.userId]?.avatar} name={a.displayName} className="w-12 h-12" />
              <div className="min-w-0">
                <div className="font-medium truncate">{a.displayName} <span className="text-sm text-muted-foreground">· {a.type}</span></div>
                <div className="text-sm text-muted-foreground truncate">{users[a.userId]?.email} · {formatDateTime(a.createdAt)}</div>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs self-start sm:self-center ${a.status === "pending" ? "bg-amber-50 text-amber-700" : a.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {a.status === "pending" ? "Chờ duyệt" : a.status === "approved" ? "Đã duyệt" : "Từ chối"}
            </span>
            <button onClick={() => setSelected(a)} className={btnOutline}>{a.status === "pending" ? "Xem & duyệt" : "Xem"}</button>
          </div>
        ))}
      </div>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Hồ sơ: ${selected?.displayName}`}
        size="lg"
        footer={
          selected?.status === "pending" && (
            <>
              <button onClick={() => decide(false)} disabled={pending} className={btnDanger}>Từ chối / Yêu cầu bổ sung</button>
              <button onClick={() => decide(true)} disabled={pending} className={btnPrimary}>{pending && <Spinner className="w-4 h-4" />} Duyệt & kích hoạt</button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-3">
              <Info label="Loại" value={selected.type} />
              <Info label="Chuyên môn" value={selected.specialty} />
              <Info label="Họ tên CCCD" value={selected.legalName} />
              <Info label="Số CCCD" value={selected.idNumber} />
            </div>
            {selected.bio && <Info label="Giới thiệu" value={selected.bio} />}
            <div>
              <p className="text-muted-foreground mb-1">Tags</p>
              <div className="flex flex-wrap gap-2">{selected.tags.map((t) => <span key={t} className="px-2 py-0.5 bg-secondary rounded text-xs">{t}</span>)}</div>
            </div>
            {selected.portfolioUrl && (
              <a href={selected.portfolioUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                Portfolio <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {selected.samples.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {selected.samples.map((s, i) => <img key={i} src={s} alt={`Mẫu ${i + 1}`} className="w-full aspect-square object-cover rounded-lg" />)}
              </div>
            )}
            <Info label="Khoảng giá" value={priceRangeLabel(selected.priceList)} />
            {selected.status === "pending" ? (
              <div>
                <label className="block mb-2">Ghi chú gửi creator (bắt buộc khi từ chối)</label>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Portfolio cần thêm tác phẩm full-color..." className={`${inputClass} resize-none`} />
              </div>
            ) : (
              selected.adminNote && <Info label="Ghi chú admin" value={selected.adminNote} />
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-secondary/60 rounded-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium whitespace-pre-line">{value}</p>
    </div>
  );
}

function Disputes() {
  const disputes = useDb((db) =>
    db.orders
      .filter((o) => o.dispute)
      .sort((a, b) => Number(a.status !== "disputed") - Number(b.status !== "disputed") || b.dispute!.at - a.dispute!.at)
      .map((o) => ({ o, customer: db.users.find((u) => u.id === o.customerId)?.fullName, creator: db.creators.find((c) => c.id === o.creatorId)?.name })),
  );
  if (disputes.length === 0) return <EmptyState icon={Scale} title="Không có khiếu nại nào" />;
  return (
    <div className="space-y-3">
      {disputes.map(({ o, customer, creator }) => (
        <div key={o.id} className="bg-card rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{o.code} · {o.title}</span>
            <OrderStatusBadge status={o.status} />
            <span className="ml-auto font-semibold text-primary">{formatVND(o.total)}</span>
          </div>
          <p className="text-sm text-muted-foreground">Khách: {customer} · Creator: {creator} · {formatDateTime(o.dispute!.at)}</p>
          <p className="text-sm p-3 bg-secondary rounded-lg">“{o.dispute!.reason}”</p>
          {o.dispute!.resolution && <p className="text-sm text-emerald-700">Kết quả: {o.dispute!.resolution}</p>}
          <Link to={`/orders/${o.id}`} className={btnOutline}>{o.status === "disputed" ? "Xem chi tiết & xử lý" : "Xem đơn"}</Link>
        </div>
      ))}
    </div>
  );
}

function Withdrawals() {
  const { list, users } = useDb((db) => ({
    list: [...db.withdrawals].sort((a, b) => Number(a.status !== "pending") - Number(b.status !== "pending") || b.createdAt - a.createdAt),
    users: Object.fromEntries(db.users.map((u) => [u.id, u.fullName])),
  }));
  const { pending, run } = useAction();
  if (list.length === 0) return <EmptyState icon={Wallet} title="Chưa có yêu cầu rút tiền" />;
  return (
    <div className="space-y-3">
      {list.map((w) => (
        <div key={w.id} className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium">{users[w.userId]} — {formatVND(w.amount)}</div>
            <div className="text-sm text-muted-foreground truncate">{w.method === "bank" ? "Ngân hàng" : "PayPal"}: {w.account} · {formatDateTime(w.createdAt)}</div>
          </div>
          {w.status === "pending" ? (
            <div className="flex gap-2">
              <button disabled={pending} onClick={() => run(() => reviewWithdrawal(w.id, false), "Đã từ chối và hoàn tiền vào ví")} className={btnOutline}>Từ chối</button>
              <button disabled={pending} onClick={() => run(() => reviewWithdrawal(w.id, true), "Đã xác nhận chuyển tiền")} className={btnPrimary}>Xác nhận đã chuyển</button>
            </div>
          ) : (
            <span className={`px-2.5 py-0.5 rounded-full text-xs ${w.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{w.status === "approved" ? "Đã chuyển" : "Đã từ chối"}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Orders() {
  const [q, setQ] = useState("");
  const orders = useDb((db) =>
    [...db.orders]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((o) => ({ o, customer: db.users.find((u) => u.id === o.customerId)?.fullName ?? "", creator: db.creators.find((c) => c.id === o.creatorId)?.name ?? "" })),
  );
  const visible = orders.filter(({ o, customer, creator }) => `${o.code} ${o.title} ${customer} ${creator}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã đơn, tiêu đề, tên..." className={`${inputClass} pl-9`} />
      </div>
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th className="p-3">Mã</th>
              <th className="p-3">Tiêu đề</th>
              <th className="p-3">Khách hàng</th>
              <th className="p-3">Creator</th>
              <th className="p-3">Giá trị</th>
              <th className="p-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ o, customer, creator }) => (
              <tr key={o.id} className="border-t border-border hover:bg-secondary/30">
                <td className="p-3 whitespace-nowrap"><Link to={`/orders/${o.id}`} className="text-primary hover:underline">{o.code}</Link></td>
                <td className="p-3 min-w-[180px]">{o.title}</td>
                <td className="p-3 whitespace-nowrap">{customer}</td>
                <td className="p-3 whitespace-nowrap">{creator}</td>
                <td className="p-3 whitespace-nowrap">{formatVND(o.total)}</td>
                <td className="p-3"><OrderStatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const users = useDb((db) => [...db.users].sort((a, b) => b.createdAt - a.createdAt));
  const visible = users.filter((u) => `${u.fullName} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên hoặc email..." className={`${inputClass} pl-9`} />
      </div>
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th className="p-3">Người dùng</th>
              <th className="p-3">Vai trò</th>
              <th className="p-3">Xác thực</th>
              <th className="p-3">Số dư</th>
              <th className="p-3">Tham gia</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3">
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <Avatar src={u.avatar} name={u.fullName} className="w-8 h-8" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {u.role === "admin" ? "Admin" : u.creatorStatus === "approved" ? <Link to={`/creator/${u.creatorId}`} className="text-primary hover:underline">Creator</Link> : u.creatorStatus === "pending" ? "Chờ duyệt creator" : "Khách hàng"}
                </td>
                <td className="p-3">{u.emailVerified ? "✅" : "⏳"}</td>
                <td className="p-3 whitespace-nowrap">{formatVND(u.balance)}</td>
                <td className="p-3 whitespace-nowrap">{formatDateTime(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
