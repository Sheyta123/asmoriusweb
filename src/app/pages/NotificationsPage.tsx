import { useState } from "react";
import { useNavigate } from "react-router";
import { Bell, UserPlus, FileText, CheckCircle, MessageSquare, Wallet, Sparkles, Newspaper, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { timeAgo } from "../lib/format";
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from "../lib/api/core";
import type { NotificationType } from "../lib/types";
import { EmptyState } from "../components/common";

const ICONS: Record<NotificationType, React.ElementType> = {
  order: FileText,
  message: MessageSquare,
  follow: UserPlus,
  system: Bell,
  payment: Wallet,
  creator: Sparkles,
  post: Newspaper,
};

export function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const notifications = useDb((db) => db.notifications.filter((n) => n.userId === user!.id).sort((a, b) => b.createdAt - a.createdAt), [user?.id]);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const visible = unreadOnly ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2 gap-4">
          <h1>Bản tin Asmorius</h1>
          {unreadCount > 0 && <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm whitespace-nowrap">{unreadCount} mới</span>}
        </div>
        <p className="text-muted-foreground">Cập nhật mới nhất về creators, commissions và hoạt động của bạn</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setUnreadOnly(false)} className={`px-4 py-1.5 rounded-full text-sm ${!unreadOnly ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          Tất cả
        </button>
        <button onClick={() => setUnreadOnly(true)} className={`px-4 py-1.5 rounded-full text-sm ${unreadOnly ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          Chưa đọc
        </button>
        <button onClick={markAllNotificationsRead} disabled={unreadCount === 0} className="ml-auto px-4 py-1.5 rounded-full text-sm border border-border hover:bg-secondary disabled:opacity-50 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" /> Đánh dấu tất cả đã đọc
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Bell} title={unreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo"} description="Các thông báo của bạn sẽ hiển thị ở đây" />
      ) : (
        <div className="space-y-3">
          {visible.map((notification) => {
            const Icon = ICONS[notification.type] ?? Bell;
            return (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  markNotificationRead(notification.id);
                  if (notification.link) navigate(notification.link);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLElement).click()}
                className={`group p-4 sm:p-5 rounded-xl border hover:shadow-md transition-all cursor-pointer ${notification.isRead ? "bg-card border-border" : "bg-primary/5 border-primary/30"}`}
              >
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${notification.isRead ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <h3 className="text-base">{notification.title}</h3>
                      <div className="flex items-center gap-2">
                        {!notification.isRead && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          aria-label="Xóa thông báo"
                          className="p-1 text-muted-foreground hover:text-destructive opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(notification.createdAt)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
