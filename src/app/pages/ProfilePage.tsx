import { useState } from "react";
import { Link } from "react-router";
import { Settings, Camera, Sparkles, Clock, Store, XCircle, ImageOff, Users, Wallet, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { memberSince } from "../lib/format";
import { formatVND } from "../lib/pricing";
import { updateProfile } from "../lib/api/auth";
import { toggleFollow } from "../lib/api/social";
import { Avatar, EmptyState, ImagePicker, Modal, OrderStatusBadge, btnPrimary } from "../components/common";
import { PostCard, PostComposer } from "../components/PostCard";

const ACTIVE = ["pending", "accepted", "in_progress", "delivered", "disputed"];

export function ProfilePage() {
  const { user, creator } = useAuth();
  const me = user!;
  const [showFollowing, setShowFollowing] = useState(false);

  const data = useDb(
    (db) => {
      const myOrders = db.orders.filter((o) => o.customerId === me.id).sort((a, b) => b.updatedAt - a.updatedAt);
      const workInDuty = db.orders.filter((o) => o.creatorUserId === me.id && ACTIVE.includes(o.status));
      const following = db.follows
        .filter((f) => f.userId === me.id)
        .map((f) => db.creators.find((c) => c.id === f.creatorId))
        .filter((c): c is NonNullable<typeof c> => !!c);
      const followers = creator ? db.follows.filter((f) => f.creatorId === creator.id).length : 0;
      const posts = db.posts.filter((p) => p.authorId === me.id).sort((a, b) => b.createdAt - a.createdAt);
      const application = [...db.applications].reverse().find((a) => a.userId === me.id);
      const creatorNames = Object.fromEntries(db.creators.map((c) => [c.id, c.name]));
      return { myOrders, workInDuty, following, followers, posts, application, creatorNames };
    },
    [me.id, creator?.id],
  );

  const changeAvatar = async (url: string) => {
    try {
      await updateProfile({ avatar: url });
      toast.success("Đã cập nhật ảnh đại diện");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 bg-gradient-to-br from-primary/10 to-purple-600/10 rounded-2xl border border-border p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative flex-shrink-0">
            <Avatar src={me.avatar} name={me.fullName} className="w-32 h-32 border-4 border-white shadow-lg text-4xl" />
            <ImagePicker onPick={([u]) => changeAvatar(u!)} maxSize={400} className="absolute bottom-0 right-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors">
              <Camera className="w-5 h-5" />
            </ImagePicker>
          </div>

          <div className="flex-1 text-center md:text-left space-y-1">
            <h1>{me.fullName}</h1>
            <p className="text-primary">{me.email}</p>
            <p className="text-muted-foreground text-sm">Thành viên từ {memberSince(me.createdAt)}</p>
            {me.bio && <p className="text-sm pt-1">{me.bio}</p>}
          </div>

          <div className="flex gap-6 text-center flex-shrink-0">
            <Link to="/orders" className="space-y-1 hover:opacity-80 transition-opacity">
              <div className="text-2xl font-bold text-primary">{data.myOrders.length}</div>
              <div className="text-sm text-primary">Commissions</div>
            </Link>
            {creator && (
              <Link to="/orders?role=creator" className="space-y-1 hover:opacity-80 transition-opacity">
                <div className="text-2xl font-bold text-primary">{data.workInDuty.length}</div>
                <div className="text-sm text-primary">Work in duty</div>
              </Link>
            )}
            <button onClick={() => setShowFollowing(true)} className="space-y-1 hover:opacity-80 transition-opacity">
              <div className="text-2xl font-bold text-primary">{data.following.length}</div>
              <div className="text-sm text-primary">Following</div>
            </button>
            {creator && (
              <div className="space-y-1">
                <div className="text-2xl font-bold">{data.followers}</div>
                <div className="text-sm text-muted-foreground">Followers</div>
              </div>
            )}
          </div>

          <Link to="/settings" className="px-6 py-3 bg-card border border-border rounded-lg hover:bg-secondary transition-colors flex items-center gap-2 flex-shrink-0">
            <Settings className="w-5 h-5" />
            Cài đặt
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
          <h2>Bài đăng</h2>
          <PostComposer />
          {data.posts.length === 0 ? <EmptyState icon={ImageOff} title="Bạn chưa có bài đăng nào" description="Chia sẻ OC, tác phẩm đã nhận hoặc cảm nhận về creator." /> : data.posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>

        <div className="space-y-6 order-1 lg:order-2">
          <CreatorStatusCard />

          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3>Commission gần đây</h3>
              <Link to="/orders" className="text-sm text-primary hover:underline">Xem tất cả</Link>
            </div>
            {data.myOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bạn chưa đặt commission nào. <Link to="/find-creators" className="text-primary hover:underline">Tìm creator</Link></p>
            ) : (
              <div className="space-y-3">
                {data.myOrders.slice(0, 4).map((o) => (
                  <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-secondary">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{o.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{data.creatorNames[o.creatorId]}</div>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={showFollowing} onClose={() => setShowFollowing(false)} title="Danh sách Following" size="lg">
        {data.following.length === 0 ? (
          <EmptyState icon={Users} title="Bạn chưa theo dõi creator nào" action={<Link to="/find-creators" className={btnPrimary}>Khám phá creator</Link>} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.following.map((c) => (
              <div key={c.id} className="bg-secondary rounded-xl border border-border p-5">
                <div className="flex items-center gap-4">
                  <Avatar src={c.image} name={c.name} className="w-14 h-14" />
                  <div className="flex-1 min-w-0">
                    <h4 className="truncate">{c.name}</h4>
                    <p className="text-sm text-muted-foreground truncate">{c.specialty}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to={`/creator/${c.id}`} onClick={() => setShowFollowing(false)} className="flex-1 py-2 text-center bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm">
                    Xem hồ sơ
                  </Link>
                  <button
                    onClick={() => {
                      toggleFollow(c.id);
                      toast.success(`Đã bỏ theo dõi ${c.name}`);
                    }}
                    className="px-4 py-2 border border-border rounded-lg bg-card hover:bg-secondary transition-colors text-sm"
                  >
                    Bỏ follow
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function CreatorStatusCard() {
  const { user, creator, isAdmin } = useAuth();
  const application = useDb((db) => [...db.applications].reverse().find((a) => a.userId === user!.id), [user?.id]);
  if (isAdmin) return null;

  if (creator) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <h3>Cửa hàng creator</h3>
        </div>
        <Link to={`/creator/${creator.id}`} className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80">
          <Avatar src={creator.image} name={creator.name} className="w-10 h-10" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{creator.name}</div>
            <div className="text-xs text-muted-foreground">{creator.isOpen ? "Đang mở đơn" : "Tạm đóng đơn"}</div>
          </div>
          <ChevronRight className="w-4 h-4" />
        </Link>
        <Link to="/wallet" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary">
          <span className="flex items-center gap-2 text-sm"><Wallet className="w-4 h-4" /> Số dư ví</span>
          <span className="font-semibold text-primary">{formatVND(user!.balance)}</span>
        </Link>
      </div>
    );
  }

  if (user!.creatorStatus === "pending") {
    return (
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 space-y-2">
        <div className="flex items-center gap-2 text-amber-800"><Clock className="w-5 h-5" /><h3>Hồ sơ creator đang chờ duyệt</h3></div>
        <p className="text-sm text-amber-800/80">Đội ngũ Asmorius đang kiểm duyệt portfolio và thông tin định danh của bạn (KYC). Bạn sẽ nhận thông báo khi có kết quả.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary/10 to-purple-600/10 rounded-2xl border border-border p-6 space-y-3">
      {user!.creatorStatus === "rejected" && application ? (
        <>
          <div className="flex items-center gap-2 text-destructive"><XCircle className="w-5 h-5" /><h3>Hồ sơ chưa đạt</h3></div>
          <p className="text-sm">Phản hồi từ Admin: “{application.adminNote}”</p>
          <Link to="/become-creator" className={btnPrimary}>Bổ sung & nộp lại</Link>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /><h3>Trở thành Creator</h3></div>
          <p className="text-sm text-muted-foreground">Nộp portfolio để mở cửa hàng, thiết lập bảng giá và nhận commission.</p>
          <Link to="/become-creator" className={btnPrimary}>Đăng ký ngay</Link>
        </>
      )}
    </div>
  );
}
