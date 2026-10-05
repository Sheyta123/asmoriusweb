import { getDb, mutate, uid } from "../db";
import { conversationIdOf } from "../ids";
import { emptyPriceList } from "../pricing";
import type { CreatorApplication, PriceList } from "../types";
import { ApiError, delay, findUser, pushNotification, requireAdmin, requireUser } from "./core";

// ---- Chat -------------------------------------------------------------------

export async function sendMessage(toUserId: string, text: string, image = "") {
  const user = requireUser();
  if (toUserId === user.id) throw new ApiError("Không thể nhắn tin cho chính mình");
  const to = findUser(toUserId);
  if (!to) throw new ApiError("Người nhận không tồn tại");
  if (!text.trim() && !image) return;
  mutate((db) => {
    const conversationId = conversationIdOf(user.id, toUserId);
    const firstContact = !db.messages.some((m) => m.conversationId === conversationId);
    db.messages.push({
      id: uid(),
      conversationId,
      senderId: user.id,
      text: text.trim(),
      image,
      orderId: null,
      createdAt: Date.now(),
      readBy: [user.id],
    });
    if (firstContact) {
      pushNotification({ userId: toUserId, type: "message", title: "Tin nhắn mới", message: `${user.fullName} đã bắt đầu cuộc trò chuyện với bạn`, link: `/messages?with=${user.id}` });
    }
  });
}

export function markConversationRead(otherUserId: string) {
  const user = requireUser();
  const conversationId = conversationIdOf(user.id, otherUserId);
  const unread = getDb().messages.filter((m) => m.conversationId === conversationId && !m.readBy.includes(user.id));
  if (unread.length === 0) return;
  mutate(() => unread.forEach((m) => m.readBy.push(user.id)));
}

// ---- Follow -----------------------------------------------------------------

export function toggleFollow(creatorId: number) {
  const user = requireUser();
  const db = getDb();
  const creator = db.creators.find((c) => c.id === creatorId);
  if (!creator) throw new ApiError("Creator không tồn tại");
  if (creator.userId === user.id) throw new ApiError("Bạn không thể tự theo dõi mình");
  const existing = db.follows.find((f) => f.userId === user.id && f.creatorId === creatorId);
  mutate((d) => {
    if (existing) {
      d.follows = d.follows.filter((f) => f !== existing);
    } else {
      d.follows.push({ userId: user.id, creatorId, createdAt: Date.now() });
      pushNotification({ userId: creator.userId, type: "follow", title: "Follower mới", message: `${user.fullName} đã bắt đầu theo dõi bạn`, link: "/profile" });
    }
  });
  return !existing;
}

// ---- Posts & reels ----------------------------------------------------------

export async function createPost(content: string, image: string) {
  await delay();
  const user = requireUser();
  if (!content.trim() && !image) throw new ApiError("Bài đăng cần có nội dung hoặc hình ảnh");
  mutate((db) => {
    db.posts.push({ id: uid(), authorId: user.id, content: content.trim(), image, likes: [], comments: [], createdAt: Date.now() });
    if (user.creatorId) {
      db.follows
        .filter((f) => f.creatorId === user.creatorId)
        .forEach((f) => pushNotification({ userId: f.userId, type: "post", title: "Bài đăng mới từ creator", message: `${user.fullName} vừa đăng bài mới`, link: `/creator/${user.creatorId}` }));
    }
  });
}

export function deletePost(id: string) {
  const user = requireUser();
  mutate((db) => {
    db.posts = db.posts.filter((p) => !(p.id === id && (p.authorId === user.id || user.role === "admin")));
  });
}

export function togglePostLike(id: string) {
  const user = requireUser();
  mutate((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post) return;
    post.likes = post.likes.includes(user.id) ? post.likes.filter((x) => x !== user.id) : [...post.likes, user.id];
  });
}

export function addComment(postId: string, text: string) {
  const user = requireUser();
  if (!text.trim()) return;
  mutate((db) => {
    const post = db.posts.find((p) => p.id === postId);
    if (!post) return;
    post.comments.push({ id: uid(), authorId: user.id, text: text.trim(), at: Date.now() });
    if (post.authorId !== user.id) {
      pushNotification({ userId: post.authorId, type: "post", title: "Bình luận mới", message: `${user.fullName}: ${text.trim().slice(0, 80)}`, link: "/profile" });
    }
  });
}

export async function createReel(input: { title: string; thumbnail: string; videoUrl: string; duration: string }) {
  await delay();
  const user = requireUser();
  if (user.creatorStatus !== "approved") throw new ApiError("Chỉ creator đã được duyệt mới có thể đăng Reel");
  if (input.title.trim().length < 3) throw new ApiError("Vui lòng nhập tiêu đề");
  if (!input.thumbnail) throw new ApiError("Vui lòng tải ảnh bìa");
  mutate((db) => {
    db.reels.unshift({ id: uid(), authorId: user.id, title: input.title.trim(), thumbnail: input.thumbnail, videoUrl: input.videoUrl.trim(), duration: input.duration || "0:30", likes: [], views: 0, createdAt: Date.now() });
  });
}

export function toggleReelLike(id: string) {
  const user = requireUser();
  mutate((db) => {
    const reel = db.reels.find((r) => r.id === id);
    if (!reel) return;
    reel.likes = reel.likes.includes(user.id) ? reel.likes.filter((x) => x !== user.id) : [...reel.likes, user.id];
  });
}

export function viewReel(id: string) {
  mutate((db) => {
    const reel = db.reels.find((r) => r.id === id);
    if (reel) reel.views += 1;
  });
}

// ---- Creator onboarding -----------------------------------------------------

export interface ApplicationInput {
  displayName: string;
  type: "Artist" | "Writer";
  specialty: string;
  bio: string;
  tags: string[];
  portfolioUrl: string;
  samples: string[];
  legalName: string;
  idNumber: string;
  priceList: PriceList;
}

export async function submitApplication(input: ApplicationInput) {
  await delay(400);
  const user = requireUser();
  if (user.creatorStatus === "approved") throw new ApiError("Bạn đã là creator");
  if (user.creatorStatus === "pending") throw new ApiError("Hồ sơ của bạn đang chờ duyệt");
  if (input.displayName.trim().length < 2) throw new ApiError("Vui lòng nhập tên hiển thị");
  if (input.specialty.trim().length < 3) throw new ApiError("Vui lòng nhập chuyên môn");
  if (input.tags.length === 0) throw new ApiError("Chọn ít nhất 1 tag phong cách");
  if (!/^https?:\/\/\S+\.\S+/.test(input.portfolioUrl.trim()) && input.samples.length === 0) {
    throw new ApiError("Cần link portfolio hợp lệ hoặc ít nhất 1 tác phẩm mẫu");
  }
  if (input.legalName.trim().length < 2 || !/^\d{9,12}$/.test(input.idNumber.trim())) {
    throw new ApiError("Thông tin định danh không hợp lệ (CCCD/CMND 9-12 chữ số)");
  }
  if (Object.values(input.priceList).some((v) => !Number.isFinite(v) || v < 0)) throw new ApiError("Bảng giá không hợp lệ");
  if (input.priceList.fullColor <= 0 || input.priceList.fullBody <= 0) throw new ApiError("Vui lòng nhập bảng giá");
  const taken = getDb().creators.some((c) => c.name.toLowerCase() === input.displayName.trim().toLowerCase());
  if (taken) throw new ApiError("Tên hiển thị đã được sử dụng");

  mutate((db) => {
    const app: CreatorApplication = {
      id: uid(),
      userId: user.id,
      ...input,
      displayName: input.displayName.trim(),
      specialty: input.specialty.trim(),
      bio: input.bio.trim(),
      portfolioUrl: input.portfolioUrl.trim(),
      legalName: input.legalName.trim(),
      idNumber: input.idNumber.trim(),
      status: "pending",
      adminNote: "",
      createdAt: Date.now(),
      reviewedAt: null,
    };
    db.applications.push(app);
    user.creatorStatus = "pending";
    db.users
      .filter((u) => u.role === "admin")
      .forEach((a) => pushNotification({ userId: a.id, type: "creator", title: "Hồ sơ creator mới", message: `${user.fullName} đã nộp hồ sơ đăng ký creator`, link: "/admin?tab=applications" }));
  });
}

export async function reviewApplication(id: string, approve: boolean, note: string) {
  await delay();
  requireAdmin();
  const db = getDb();
  const app = db.applications.find((a) => a.id === id);
  if (!app || app.status !== "pending") throw new ApiError("Hồ sơ không tồn tại hoặc đã được xử lý");
  if (!approve && note.trim().length < 5) throw new ApiError("Vui lòng ghi rõ lý do từ chối / yêu cầu bổ sung");
  mutate((d) => {
    const user = d.users.find((u) => u.id === app.userId)!;
    app.status = approve ? "approved" : "rejected";
    app.adminNote = note.trim();
    app.reviewedAt = Date.now();
    if (approve) {
      const id = Math.max(0, ...d.creators.map((c) => c.id)) + 1;
      const image = user.avatar || app.samples[0] || "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=300&h=300&fit=crop";
      d.creators.push({
        id,
        userId: user.id,
        name: app.displayName,
        type: app.type,
        specialty: app.specialty,
        bio: app.bio || `Chuyên về ${app.specialty}.`,
        rating: 0,
        ratingCount: 0,
        commissions: 0,
        image,
        cover: app.samples[0] || image,
        tags: app.tags,
        priceList: app.priceList,
        terms: [
          "Thanh toán 100% vào ví ký quỹ của Asmorius trước khi bắt đầu",
          "Chỉnh sửa miễn phí tối đa 3 lần",
          "Bản xem trước có watermark, file sạch mở khóa sau khi khách chấp nhận",
        ],
        isOpen: true,
        createdAt: Date.now(),
      });
      user.creatorStatus = "approved";
      user.creatorId = id;
      pushNotification({ userId: user.id, type: "creator", title: "Hồ sơ creator đã được duyệt 🎉", message: "Cửa hàng của bạn đã được kích hoạt. Hãy hoàn thiện bảng giá và bắt đầu nhận đơn!", link: `/creator/${id}` });
    } else {
      user.creatorStatus = "rejected";
      pushNotification({ userId: user.id, type: "creator", title: "Hồ sơ creator chưa đạt", message: `Lý do: ${note.trim()}. Bạn có thể bổ sung và nộp lại.`, link: "/become-creator" });
    }
  });
}

export async function updateCreatorShop(patch: { specialty?: string; bio?: string; tags?: string[]; priceList?: PriceList; isOpen?: boolean; terms?: string[] }) {
  await delay();
  const user = requireUser();
  const creator = getDb().creators.find((c) => c.id === user.creatorId);
  if (!creator) throw new ApiError("Bạn chưa có cửa hàng creator");
  if (patch.priceList && Object.values(patch.priceList).some((v) => !Number.isFinite(v) || v < 0)) {
    throw new ApiError("Bảng giá không hợp lệ");
  }
  mutate(() => Object.assign(creator, patch));
}

export function defaultPriceList(): PriceList {
  return { ...emptyPriceList(), sketch: 200000, baseColor: 400000, fullColor: 700000, shot: 150000, halfBody: 300000, fullBody: 500000, extraCharacter: 250000, background: 300000 };
}

// ---- Wallet -----------------------------------------------------------------

export const MIN_WITHDRAWAL = 100_000;

export async function requestWithdrawal(amount: number, method: "bank" | "paypal", account: string) {
  await delay(400);
  const user = requireUser();
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) throw new ApiError("Số tiền rút tối thiểu là 100.000 VND");
  if (amount > user.balance) throw new ApiError("Số dư không đủ");
  if (account.trim().length < 6) throw new ApiError("Vui lòng nhập thông tin tài khoản nhận tiền");
  mutate((db) => {
    user.balance -= amount;
    db.withdrawals.push({ id: uid(), userId: user.id, amount, method, account: account.trim(), status: "pending", createdAt: Date.now(), reviewedAt: null });
    db.transactions.push({ id: uid(), userId: user.id, type: "withdraw", amount: -amount, orderId: null, note: `Yêu cầu rút tiền về ${method === "bank" ? "ngân hàng" : "PayPal"}`, createdAt: Date.now() });
    db.users
      .filter((u) => u.role === "admin")
      .forEach((a) => pushNotification({ userId: a.id, type: "payment", title: "Yêu cầu rút tiền", message: `${user.fullName} yêu cầu rút ${amount.toLocaleString("vi-VN")} VND`, link: "/admin?tab=withdrawals" }));
  });
}

export async function reviewWithdrawal(id: string, approve: boolean) {
  await delay();
  requireAdmin();
  const w = getDb().withdrawals.find((x) => x.id === id);
  if (!w || w.status !== "pending") throw new ApiError("Yêu cầu không tồn tại hoặc đã xử lý");
  mutate((db) => {
    w.status = approve ? "approved" : "rejected";
    w.reviewedAt = Date.now();
    const user = db.users.find((u) => u.id === w.userId)!;
    if (!approve) {
      user.balance += w.amount;
      db.transactions.push({ id: uid(), userId: user.id, type: "refund", amount: w.amount, orderId: null, note: "Hoàn lại yêu cầu rút tiền bị từ chối", createdAt: Date.now() });
    }
    pushNotification({
      userId: user.id,
      type: "payment",
      title: approve ? "Rút tiền thành công" : "Yêu cầu rút tiền bị từ chối",
      message: approve ? `${w.amount.toLocaleString("vi-VN")} VND đã được chuyển về tài khoản của bạn` : "Số tiền đã được hoàn lại vào ví. Vui lòng kiểm tra thông tin tài khoản.",
      link: "/wallet",
    });
  });
}
