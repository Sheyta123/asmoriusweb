import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Star, FileText, ArrowLeft, Settings, ImageOff, MessageSquareText, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { memberSince, timeAgo } from "../lib/format";
import { priceRangeLabel } from "../lib/pricing";
import { toggleFollow } from "../lib/api/social";
import { Avatar, EmptyState } from "../components/common";
import { PostCard, PostComposer } from "../components/PostCard";
import { CommissionFormModal, TermsModal } from "../components/CommissionForm";

const ACTIVE_STATUSES = ["accepted", "in_progress", "delivered", "disputed"];

export function CreatorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const creatorId = Number(id);
  const [tab, setTab] = useState<"posts" | "reviews">("posts");
  const [showTerms, setShowTerms] = useState(false);
  const [termsForOrder, setTermsForOrder] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const data = useDb(
    (db) => {
      const creator = db.creators.find((c) => c.id === creatorId);
      if (!creator) return null;
      const owner = db.users.find((u) => u.id === creator.userId);
      const followers = db.follows.filter((f) => f.creatorId === creatorId).length;
      const isFollowing = !!user && db.follows.some((f) => f.creatorId === creatorId && f.userId === user.id);
      const workInDuty = db.orders.filter((o) => o.creatorId === creatorId && ACTIVE_STATUSES.includes(o.status)).length;
      const posts = db.posts.filter((p) => p.authorId === creator.userId).sort((a, b) => b.createdAt - a.createdAt);
      const reviews = db.orders
        .filter((o) => o.creatorId === creatorId && o.review)
        .sort((a, b) => b.review!.at - a.review!.at)
        .map((o) => {
          const c = db.users.find((u) => u.id === o.customerId);
          return { id: o.id, title: o.title, ...o.review!, customer: c?.fullName ?? "Khách hàng", avatar: c?.avatar ?? "" };
        });
      return { creator, owner, followers, isFollowing, workInDuty, posts, reviews };
    },
    [creatorId, user?.id],
  );

  if (!data) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-16">
        <EmptyState
          icon={ImageOff}
          title="Creator không tồn tại"
          action={
            <button onClick={() => navigate("/find-creators")} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg">
              Quay lại tìm kiếm
            </button>
          }
        />
      </div>
    );
  }

  const { creator, owner, followers, isFollowing, workInDuty, posts, reviews } = data;
  const isOwner = user?.id === creator.userId;

  const requireLogin = (action: string) => {
    if (user) return true;
    toast.info(`Vui lòng đăng nhập để ${action}`);
    navigate(`/login?redirect=${encodeURIComponent(`/creator/${creator.id}`)}`);
    return false;
  };

  const handleOrder = () => {
    if (!requireLogin("đặt commission")) return;
    setTermsForOrder(true);
    setShowTerms(true);
  };

  const handleFollow = () => {
    if (!requireLogin("theo dõi creator")) return;
    try {
      const nowFollowing = toggleFollow(creator.id);
      toast.success(nowFollowing ? `Đã theo dõi ${creator.name}` : `Đã bỏ theo dõi ${creator.name}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleMessage = () => {
    if (!requireLogin("nhắn tin")) return;
    navigate(`/messages?with=${creator.userId}`);
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" />
        Quay lại
      </button>

      <div className="mb-8 bg-gradient-to-br from-primary/10 to-purple-600/10 rounded-2xl border border-border p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative flex-shrink-0">
            <Avatar src={creator.image} name={creator.name} className="w-32 h-32 border-4 border-white shadow-lg text-4xl" />
            <div className="absolute bottom-0 right-0 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm">{creator.type}</div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-1">
            <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap">
              <h1>{creator.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs ${creator.isOpen ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                {creator.isOpen ? "Đang mở đơn" : "Tạm đóng đơn"}
              </span>
            </div>
            {owner && <p className="text-primary">{owner.email}</p>}
            <p className="text-muted-foreground">{creator.specialty}</p>
            <p className="text-muted-foreground text-sm">Thành viên từ {memberSince(creator.createdAt)}</p>
            <div className="flex items-center gap-2 justify-center md:justify-start mt-2">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold">{creator.ratingCount > 0 ? creator.rating.toFixed(1) : "Chưa có"}</span>
              <span className="text-muted-foreground">({creator.ratingCount} đánh giá)</span>
            </div>
          </div>

          <div className="flex gap-6 text-center flex-shrink-0">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-foreground">{creator.commissions}</div>
              <div className="text-sm text-muted-foreground">Commissions</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-foreground">{workInDuty}</div>
              <div className="text-sm text-muted-foreground">Work in duty</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-foreground">{followers}</div>
              <div className="text-sm text-muted-foreground">Followers</div>
            </div>
          </div>

          <button
            onClick={() => {
              setTermsForOrder(false);
              setShowTerms(true);
            }}
            className="px-6 py-3 bg-card border border-border rounded-lg hover:bg-secondary transition-colors flex items-center gap-2 flex-shrink-0"
          >
            <FileText className="w-5 h-5" />
            Term of Service
          </button>
        </div>

        <div className="mt-6 p-4 bg-card/50 rounded-lg">
          <p className="text-foreground whitespace-pre-line">{creator.bio}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {creator.tags.map((tag) => (
            <Link key={tag} to={`/find-creators?tag=${encodeURIComponent(tag)}`} className="px-3 py-1 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-primary hover:text-primary-foreground transition-colors">
              {tag}
            </Link>
          ))}
        </div>

        <div className="mt-4 p-4 bg-primary/10 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Mức giá:</p>
          <p className="text-lg sm:text-xl font-bold text-primary">{priceRangeLabel(creator.priceList)}</p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
          {isOwner ? (
            <Link to="/settings?tab=shop" className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
              <Settings className="w-5 h-5" /> Quản lý cửa hàng & bảng giá
            </Link>
          ) : (
            <>
              <button
                onClick={handleOrder}
                disabled={!creator.isOpen}
                className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {!creator.isOpen && <Lock className="w-4 h-4" />}
                {creator.isOpen ? "Đặt Commission" : "Tạm đóng nhận đơn"}
              </button>
              <button
                onClick={handleFollow}
                className={`flex-1 px-6 py-3 rounded-lg transition-colors ${
                  isFollowing ? "bg-secondary text-secondary-foreground border border-border" : "border border-border hover:bg-secondary"
                }`}
              >
                {isFollowing ? "Đã theo dõi" : "Theo dõi"}
              </button>
              <button onClick={handleMessage} className="px-6 py-3 border border-border rounded-lg hover:bg-secondary transition-colors">
                Nhắn tin
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        {(
          [
            ["posts", `Bài đăng (${posts.length})`],
            ["reviews", `Đánh giá (${reviews.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 -mb-px border-b-2 transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "posts" ? (
        <div className="space-y-6 max-w-3xl">
          {isOwner && <PostComposer />}
          {posts.length === 0 ? <EmptyState icon={ImageOff} title="Chưa có bài đăng" /> : posts.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {reviews.length === 0 ? (
            <EmptyState icon={MessageSquareText} title="Chưa có đánh giá" description="Đánh giá chỉ đến từ khách hàng đã hoàn thành đơn hàng." />
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="bg-card rounded-xl border border-border p-5 space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar src={r.avatar} name={r.customer} className="w-10 h-10" />
                  <div className="flex-1">
                    <div className="font-medium">{r.customer}</div>
                    <div className="text-xs text-muted-foreground">{r.title} · {timeAgo(r.at)}</div>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`w-4 h-4 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-sm">{r.comment}</p>}
              </div>
            ))
          )}
        </div>
      )}

      <TermsModal
        creator={creator}
        open={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={
          termsForOrder && !isOwner && creator.isOpen
            ? () => {
                setShowTerms(false);
                setShowForm(true);
              }
            : undefined
        }
      />
      {showForm && <CommissionFormModal creator={creator} open={showForm} onClose={() => setShowForm(false)} />}
    </div>
  );
}
