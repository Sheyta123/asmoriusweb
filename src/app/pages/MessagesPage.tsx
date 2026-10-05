import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, Send, ArrowLeft, MessagesSquare, X, ImagePlus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { conversationIdOf } from "../lib/ids";
import { formatTime, timeAgo } from "../lib/format";
import { markConversationRead, sendMessage } from "../lib/api/social";
import { Avatar, EmptyState, ImagePicker, Modal } from "../components/common";

export function MessagesPage() {
  const { user } = useAuth();
  const me = user!;
  const [params, setParams] = useSearchParams();
  const activeId = params.get("with");
  const [messageText, setMessageText] = useState("");
  const [attachment, setAttachment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { conversations, people } = useDb(
    (db) => {
      const mine = db.messages.filter((m) => m.conversationId.split("__").includes(me.id));
      const byConv = new Map<string, typeof mine>();
      mine.forEach((m) => byConv.set(m.conversationId, [...(byConv.get(m.conversationId) ?? []), m]));
      const otherIds = new Set<string>([...byConv.keys()].map((cid) => cid.split("__").find((x) => x !== me.id)!));
      if (activeId && activeId !== me.id) otherIds.add(activeId);
      const people = Object.fromEntries(
        [...otherIds].map((id) => {
          const u = db.users.find((x) => x.id === id);
          const c = u?.creatorId ? db.creators.find((x) => x.id === u.creatorId) : undefined;
          return [id, { id, name: c?.name ?? u?.fullName ?? "Người dùng", avatar: c?.image ?? u?.avatar ?? "", creatorId: c?.id ?? null, exists: !!u }];
        }),
      );
      const conversations = [...otherIds]
        .map((otherId) => {
          const msgs = byConv.get(conversationIdOf(me.id, otherId)) ?? [];
          const last = msgs[msgs.length - 1];
          return {
            otherId,
            last,
            unread: msgs.filter((m) => m.senderId !== me.id && !m.readBy.includes(me.id)).length,
          };
        })
        .sort((a, b) => (b.last?.createdAt ?? Date.now()) - (a.last?.createdAt ?? Date.now()));
      return { conversations, people };
    },
    [me.id, activeId],
  );

  const messages = useDb(
    (db) => (activeId ? db.messages.filter((m) => m.conversationId === conversationIdOf(me.id, activeId)).sort((a, b) => a.createdAt - b.createdAt) : []),
    [me.id, activeId],
  );

  const orderTitles = useDb((db) => Object.fromEntries(db.orders.map((o) => [o.id, `${o.code} · ${o.title}`])));

  const active = activeId ? people[activeId] : undefined;

  useEffect(() => {
    if (activeId && active?.exists) markConversationRead(activeId);
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [activeId, messages.length, active?.exists]);

  const filtered = useMemo(
    () => conversations.filter((c) => people[c.otherId]?.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [conversations, people, searchQuery],
  );

  const handleSendMessage = async () => {
    if (!activeId || (!messageText.trim() && !attachment)) return;
    try {
      await sendMessage(activeId, messageText, attachment);
      setMessageText("");
      setAttachment("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openConversation = (id: string | null) => setParams(id ? { with: id } : {});

  return (
    <div className="container max-w-7xl mx-auto px-0 sm:px-4 py-0 sm:py-8">
      <div className="bg-card sm:rounded-2xl border-y sm:border border-border overflow-hidden h-[calc(100dvh-8rem)] lg:h-[calc(100vh-12rem)] flex">
        {/* Conversations List */}
        <div className={`w-full md:w-80 md:border-r border-border flex-col ${activeId ? "hidden md:flex" : "flex"}`}>
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm cuộc trò chuyện..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="p-6 text-sm text-center text-muted-foreground">
                Chưa có cuộc trò chuyện nào. Vào trang creator và bấm “Nhắn tin” để bắt đầu.
              </p>
            )}
            {filtered.map((conv) => {
              const p = people[conv.otherId]!;
              const preview = conv.last ? (conv.last.senderId === me.id ? "Bạn: " : "") + (conv.last.text || "📷 Hình ảnh") : "Bắt đầu cuộc trò chuyện";
              return (
                <button
                  key={conv.otherId}
                  onClick={() => openConversation(conv.otherId)}
                  className={`w-full text-left p-4 hover:bg-secondary transition-colors border-b border-border ${activeId === conv.otherId ? "bg-secondary" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={p.avatar} name={p.name} className="w-12 h-12" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="truncate text-sm">{p.name}</h4>
                        {conv.last && <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(conv.last.createdAt)}</span>}
                      </div>
                      <p className={`text-sm truncate ${conv.unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>{preview}</p>
                    </div>
                    {conv.unread > 0 && (
                      <div className="min-w-5 h-5 px-1 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold">{conv.unread}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat Area */}
        {active ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => openConversation(null)} aria-label="Quay lại" className="md:hidden p-1 -ml-1">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar src={active.avatar} name={active.name} className="w-10 h-10" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate">{active.name}</h3>
                  <p className="text-xs text-muted-foreground">{active.creatorId ? "Creator" : "Thành viên"}</p>
                </div>
              </div>
              {active.creatorId && (
                <Link to={`/creator/${active.creatorId}`} className="px-3 sm:px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors whitespace-nowrap">
                  Xem hồ sơ
                </Link>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Gửi lời chào tới {active.name} 👋</p>}
              {messages.map((message) => {
                if (message.senderId === "system") {
                  return (
                    <div key={message.id} className="flex justify-center">
                      <div className="max-w-[90%] text-center text-xs bg-secondary/70 text-secondary-foreground rounded-xl px-4 py-2 space-y-1">
                        <p>{message.text}</p>
                        {message.image && <img src={message.image} alt="" onClick={() => setZoom(message.image)} className="max-h-40 rounded-lg mx-auto cursor-zoom-in" />}
                        {message.orderId && (
                          <Link to={`/orders/${message.orderId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                            Xem đơn hàng <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                        <p className="text-muted-foreground">{formatTime(message.createdAt)}</p>
                      </div>
                    </div>
                  );
                }
                const mine = message.senderId === me.id;
                return (
                  <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                      {message.image && <img src={message.image} alt="Ảnh" onClick={() => setZoom(message.image)} className="rounded-lg mb-1 max-h-64 cursor-zoom-in" />}
                      {message.text && <p className="text-sm whitespace-pre-line break-words">{message.text}</p>}
                      {message.orderId && orderTitles[message.orderId] && (
                        <Link to={`/orders/${message.orderId}`} className={`text-xs underline ${mine ? "text-primary-foreground/80" : "text-primary"}`}>
                          {orderTitles[message.orderId]}
                        </Link>
                      )}
                      <p className={`text-xs mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatTime(message.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 sm:p-4 border-t border-border space-y-2">
              {attachment && (
                <div className="relative inline-block">
                  <img src={attachment} alt="Đính kèm" className="h-20 rounded-lg" />
                  <button onClick={() => setAttachment("")} aria-label="Bỏ ảnh" className="absolute -top-2 -right-2 p-0.5 bg-destructive text-white rounded-full">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 sm:gap-3">
                <ImagePicker onPick={([u]) => setAttachment(u!)} className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground">
                  <ImagePlus className="w-5 h-5" />
                </ImagePicker>
                <input
                  type="text"
                  placeholder="Nhập tin nhắn..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleSendMessage()}
                  className="flex-1 min-w-0 px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() && !attachment}
                  aria-label="Gửi"
                  className="p-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center">
            <EmptyState icon={MessagesSquare} title="Chọn một cuộc trò chuyện để bắt đầu" />
          </div>
        )}
      </div>
      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Hình ảnh" size="xl">
        {zoom && <img src={zoom} alt="Hình ảnh" className="w-full max-h-[70vh] object-contain" />}
      </Modal>
    </div>
  );
}
