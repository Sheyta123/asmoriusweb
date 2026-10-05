import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ClipboardList, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { formatDate, timeAgo } from "../lib/format";
import { formatVND } from "../lib/pricing";
import type { Order, OrderStatus } from "../lib/types";
import { Avatar, EmptyState, OrderStatusBadge, btnPrimary } from "../components/common";

const FILTERS: { value: string; label: string; statuses: OrderStatus[] }[] = [
  { value: "all", label: "Tất cả", statuses: [] },
  { value: "active", label: "Đang xử lý", statuses: ["pending", "accepted", "in_progress", "delivered", "disputed"] },
  { value: "completed", label: "Hoàn thành", statuses: ["completed"] },
  { value: "closed", label: "Đã hủy / hoàn tiền", statuses: ["cancelled", "rejected", "refunded"] },
];

/** Statuses where the ball is in this party's court. */
const NEEDS_CUSTOMER: OrderStatus[] = ["accepted", "delivered"];
const NEEDS_CREATOR: OrderStatus[] = ["pending", "in_progress"];

export function OrdersPage() {
  const { user, creator } = useAuth();
  const [params, setParams] = useSearchParams();
  const role = params.get("role") === "creator" && creator ? "creator" : "customer";
  const [filter, setFilter] = useState("all");

  const orders = useDb(
    (db) =>
      db.orders
        .filter((o) => (role === "creator" ? o.creatorUserId === user!.id : o.customerId === user!.id))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((o) => {
          const otherId = role === "creator" ? o.customerId : o.creatorUserId;
          const other = db.users.find((u) => u.id === otherId);
          const c = db.creators.find((x) => x.id === o.creatorId);
          return { order: o, otherName: role === "creator" ? (other?.fullName ?? "") : (c?.name ?? other?.fullName ?? ""), otherAvatar: role === "creator" ? other?.avatar : c?.image };
        }),
    [user?.id, role],
  );

  const statuses = FILTERS.find((f) => f.value === filter)!.statuses;
  const visible = statuses.length ? orders.filter((o) => statuses.includes(o.order.status)) : orders;
  const needsMe = (o: Order) => (role === "creator" ? NEEDS_CREATOR : NEEDS_CUSTOMER).includes(o.status);
  const actionCount = orders.filter((o) => needsMe(o.order)).length;

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-1">Đơn hàng</h1>
        <p className="text-muted-foreground">Theo dõi tiến độ commission, ký quỹ và nghiệm thu</p>
      </div>

      {creator && (
        <div className="flex gap-2 mb-4 border-b border-border">
          {(
            [
              ["customer", "Đơn tôi đặt"],
              ["creator", "Đơn tôi nhận (Work in duty)"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setParams(key === "creator" ? { role: "creator" } : {})}
              className={`px-4 py-2 -mb-px border-b-2 transition-colors ${role === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${filter === f.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
          >
            {f.label}
          </button>
        ))}
        {actionCount > 0 && <span className="ml-auto text-sm text-primary self-center">{actionCount} đơn cần bạn xử lý</span>}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Chưa có đơn hàng"
          description={role === "creator" ? "Khi khách hàng gửi yêu cầu, đơn sẽ xuất hiện ở đây." : "Tìm creator yêu thích và gửi yêu cầu commission đầu tiên của bạn."}
          action={role === "customer" && <Link to="/find-creators" className={btnPrimary}>Tìm creator</Link>}
        />
      ) : (
        <div className="space-y-3">
          {visible.map(({ order, otherName, otherAvatar }) => (
            <Link key={order.id} to={`/orders/${order.id}`} className="block bg-card rounded-xl border border-border p-4 sm:p-5 hover:shadow-md transition-shadow">
              <div className="flex gap-4 items-center">
                {order.delivery?.preview || order.drafts[0]?.image || order.references[0] ? (
                  <img src={order.delivery?.preview || order.drafts[0]?.image || order.references[0]} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <Avatar src={otherAvatar} name={otherName} className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base truncate">{order.title}</h3>
                    <OrderStatusBadge status={order.status} />
                    {needsMe(order) && <span className="w-2 h-2 rounded-full bg-destructive" title="Cần bạn xử lý" />}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {role === "creator" ? "Khách hàng" : "Creator"}: {otherName} · {order.code}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deadline {formatDate(order.deadline)} · Cập nhật {timeAgo(order.updatedAt)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="font-semibold text-primary">{formatVND(order.total)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
