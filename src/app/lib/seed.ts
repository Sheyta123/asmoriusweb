// Demo dataset loaded on first visit (or after "reset data").

import { allCreatorsData } from "../data/creatorsData";
import { generateSalt, hashPassword } from "./crypto";
import { conversationIdOf, orderCode, uid } from "./ids";
import { computeTotal } from "./pricing";
import type {
  Creator,
  Database,
  Message,
  Notification,
  Order,
  Post,
  PriceList,
  Reel,
  Transaction,
  User,
} from "./types";

export const DEMO_ACCOUNTS = {
  admin: { email: "admin@asmorius.vn", password: "Admin@123" },
  customer: { email: "khachhang@asmorius.vn", password: "Demo@123" },
  creator: { email: "luna.artwork@asmorius.vn", password: "Creator@123" },
};

const HOUR = 3600_000;
const DAY = 24 * HOUR;

const PRICE_TIERS: Record<"low" | "mid" | "high", PriceList> = {
  low: { sketch: 150000, baseColor: 300000, fullColor: 500000, shot: 100000, halfBody: 200000, fullBody: 350000, extraCharacter: 200000, background: 250000 },
  mid: { sketch: 800000, baseColor: 1500000, fullColor: 2500000, shot: 500000, halfBody: 1000000, fullBody: 1800000, extraCharacter: 1000000, background: 1200000 },
  high: { sketch: 2500000, baseColor: 4000000, fullColor: 6000000, shot: 1500000, halfBody: 3000000, fullBody: 5000000, extraCharacter: 3000000, background: 3500000 },
};

const DEFAULT_TERMS = [
  "Thanh toán 100% vào ví ký quỹ của Asmorius trước khi bắt đầu — tiền chỉ được giải ngân khi bạn chấp nhận sản phẩm",
  "Chỉnh sửa miễn phí tối đa 3 lần trong giai đoạn sketch",
  "Thời gian hoàn thành: 7-14 ngày tùy độ phức tạp",
  "File giao: PNG/JPG chất lượng cao, 300 DPI (bản xem trước có watermark)",
  "Khách hàng được sử dụng cá nhân; creator được dùng tác phẩm để quảng bá portfolio",
  "Không nhận: nội dung 18+, bạo lực quá mức, đạo nhái, phân biệt chủng tộc/tôn giáo",
];

function slug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function tierFromRange(range: string): keyof typeof PRICE_TIERS {
  if (range.startsWith("50.000")) return "low";
  if (range.startsWith("from")) return "high";
  return "mid";
}

function varyPrices(base: PriceList, seed: number): PriceList {
  const factor = 0.85 + ((seed * 37) % 31) / 100; // 0.85 – 1.15
  const round = (n: number) => Math.round((n * factor) / 50000) * 50000 || 50000;
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, round(v)])) as unknown as PriceList;
}

async function makeUser(partial: Partial<User> & { email: string; fullName: string }, password: string, createdAt: number): Promise<User> {
  const salt = generateSalt();
  return {
    id: uid(),
    passwordHash: await hashPassword(password, salt),
    salt,
    avatar: "",
    bio: "",
    phone: "",
    role: "user",
    emailVerified: true,
    creatorStatus: "none",
    creatorId: null,
    balance: 0,
    createdAt,
    ...partial,
  };
}

const POST_TEMPLATES = [
  { content: "Vừa hoàn thành commission này! Cảm ơn khách hàng đã tin tưởng 🎨", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=800&fit=crop" },
  { content: "Đang thử nghiệm vài thiết kế nhân vật mới cho dự án sắp tới. Mọi người đón chờ nhé ✨", image: "" },
  { content: "Buổi luyện sketch cuối tuần 💜 Slot commission tháng sau đã mở!", image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&h=800&fit=crop" },
];

const REEL_SEED = [
  { creator: 1, title: "Speed painting: Dark fantasy character", thumbnail: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=600&fit=crop", duration: "0:45", views: 12430 },
  { creator: 2, title: "Pastel character design process", thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop", duration: "1:20", views: 8920 },
  { creator: 3, title: "Cyberpunk city sketch", thumbnail: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=600&fit=crop", duration: "2:10", views: 21560 },
  { creator: 4, title: "Gothic horror illustration", thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=600&fit=crop", duration: "1:45", views: 15670 },
  { creator: 5, title: "Chibi character cuteness overload", thumbnail: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&h=600&fit=crop", duration: "1:05", views: 9780 },
  { creator: 6, title: "Cyberpunk neon scene WIP", thumbnail: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=600&fit=crop", duration: "0:55", views: 18340 },
  { creator: 10, title: "Realistic portrait painting", thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=600&fit=crop", duration: "3:20", views: 23450 },
  { creator: 11, title: "Pixel art game character", thumbnail: "https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=400&h=600&fit=crop", duration: "1:15", views: 14560 },
];

export async function createSeedDatabase(): Promise<Database> {
  const now = Date.now();
  const users: User[] = [];
  const creators: Creator[] = [];

  const admin = await makeUser(
    { email: DEMO_ACCOUNTS.admin.email, fullName: "Asmorius Admin", role: "admin", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop" },
    DEMO_ACCOUNTS.admin.password,
    now - 400 * DAY,
  );
  const customer = await makeUser(
    { email: DEMO_ACCOUNTS.customer.email, fullName: "Nguyễn Văn A", bio: "Mê OC và dark fantasy. Đang sưu tầm art cho nhân vật của mình.", phone: "0901234567", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop" },
    DEMO_ACCOUNTS.customer.password,
    now - 200 * DAY,
  );
  const customerB = await makeUser(
    { email: "tranthib@asmorius.vn", fullName: "Trần Thị B", bio: "Viết truyện ngắn fantasy, đang ứng tuyển làm writer.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop", creatorStatus: "pending" },
    DEMO_ACCOUNTS.customer.password,
    now - 90 * DAY,
  );
  users.push(admin, customer, customerB);

  for (const c of allCreatorsData) {
    const createdAt = now - (500 - c.id * 9) * DAY;
    const user = await makeUser(
      {
        email: `${slug(c.name)}@asmorius.vn`,
        fullName: c.name,
        avatar: c.image,
        bio: `Chuyên về ${c.specialty}. Đam mê tạo ra những tác phẩm độc đáo và ấn tượng.`,
        creatorStatus: "approved",
        creatorId: c.id,
        balance: c.id === 1 ? 8_400_000 : 0,
      },
      DEMO_ACCOUNTS.creator.password,
      createdAt,
    );
    users.push(user);
    creators.push({
      id: c.id,
      userId: user.id,
      name: c.name,
      type: c.type as Creator["type"],
      specialty: c.specialty,
      bio: user.bio,
      rating: c.rating,
      ratingCount: Math.round(c.commissions * 0.6),
      commissions: c.commissions,
      image: c.image,
      cover: c.image.replace("w=300&h=300", "w=1200&h=400"),
      tags: c.tags,
      priceList: varyPrices(PRICE_TIERS[tierFromRange(c.priceRange)], c.id),
      terms: DEFAULT_TERMS,
      isOpen: c.id % 9 !== 0,
      createdAt,
    });
  }

  const creatorUser = (id: number) => users.find((u) => u.creatorId === id)!;
  const creatorById = (id: number) => creators.find((c) => c.id === id)!;
  const luna = creatorUser(1);
  const starlight = creatorUser(2);
  const nebula = creatorUser(3);

  // ---- Orders --------------------------------------------------------------
  let seq = 1;
  const makeOrder = (o: Partial<Order> & Pick<Order, "customerId" | "creatorId" | "title" | "brief" | "status" | "options">, createdAt: number): Order => {
    const creator = creatorById(o.creatorId);
    const total = computeTotal(creator.priceList, o.options);
    return {
      id: uid(),
      code: orderCode(seq++),
      creatorUserId: creator.userId,
      details: "",
      colorNotes: "",
      references: [],
      deadline: new Date(createdAt + 14 * DAY).toISOString().slice(0, 10),
      total,
      rejectReason: "",
      payment: null,
      drafts: [],
      delivery: null,
      revisionCount: 0,
      dispute: null,
      review: null,
      events: [{ at: createdAt, by: o.customerId, text: "Khách hàng đã gửi yêu cầu commission" }],
      createdAt,
      updatedAt: createdAt,
      ...o,
    };
  };

  const o1 = makeOrder(
    {
      customerId: customer.id,
      creatorId: 1,
      title: "Dark Fantasy Character Design",
      brief: "Thiết kế OC nữ pháp sư hắc ám, tóc bạc dài, mắt đỏ, áo choàng đen có hoa văn bạc.",
      details: "Tư thế đứng cầm quyền trượng, ánh sáng từ dưới lên tạo cảm giác bí ẩn.",
      colorNotes: "Tông chủ đạo đen - bạc - đỏ thẫm",
      status: "in_progress",
      options: { format: "fullColor", bodyType: "fullBody", extraCharacters: 0, background: true },
    },
    now - 6 * DAY,
  );
  o1.payment = { method: "momo", amount: o1.total, paidAt: now - 5 * DAY };
  o1.drafts = [{ image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&h=800&fit=crop", note: "Sketch tư thế đầu tiên, bạn xem thử nhé!", at: now - 2 * DAY }];
  o1.events.push(
    { at: now - 5.5 * DAY, by: luna.id, text: "Creator đã chấp nhận và chốt đơn" },
    { at: now - 5 * DAY, by: customer.id, text: "Đã thanh toán ký quỹ qua MoMo" },
    { at: now - 2 * DAY, by: luna.id, text: "Creator đã gửi bản nháp" },
  );

  const o2 = makeOrder(
    {
      customerId: customer.id,
      creatorId: 2,
      title: "Pastel Couple Illustration",
      brief: "Vẽ couple OC phong cách pastel, hai nhân vật đang ngồi dưới cây anh đào.",
      colorNotes: "Hồng pastel, xanh mint nhạt",
      status: "delivered",
      options: { format: "fullColor", bodyType: "halfBody", extraCharacters: 1, background: true },
    },
    now - 12 * DAY,
  );
  const o2File = uid();
  o2.payment = { method: "zalopay", amount: o2.total, paidAt: now - 11 * DAY };
  o2.delivery = { preview: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1000&h=1000&fit=crop", fileId: o2File, note: "Bản hoàn thiện đây ạ! Bạn kiểm tra giúp mình nhé 💕", at: now - 3 * HOUR };
  o2.events.push(
    { at: now - 11.5 * DAY, by: starlight.id, text: "Creator đã chấp nhận và chốt đơn" },
    { at: now - 11 * DAY, by: customer.id, text: "Đã thanh toán ký quỹ qua ZaloPay" },
    { at: now - 3 * HOUR, by: starlight.id, text: "Creator đã bàn giao sản phẩm hoàn thiện (có watermark)" },
  );

  const o3 = makeOrder(
    {
      customerId: customer.id,
      creatorId: 3,
      title: "Cyberpunk Street Samurai",
      brief: "Nhân vật samurai đường phố cyberpunk, áo khoác neon, katana phát sáng.",
      status: "completed",
      options: { format: "fullColor", bodyType: "fullBody", extraCharacters: 0, background: false },
    },
    now - 40 * DAY,
  );
  const o3File = uid();
  o3.payment = { method: "paypal", amount: o3.total, paidAt: now - 39 * DAY };
  o3.delivery = { preview: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1000&h=1000&fit=crop", fileId: o3File, note: "Hoàn thành!", at: now - 30 * DAY };
  o3.review = { rating: 5, comment: "Tuyệt vời! Đúng y như mình tưởng tượng, giao đúng hẹn.", at: now - 29 * DAY };
  o3.events.push(
    { at: now - 39 * DAY, by: customer.id, text: "Đã thanh toán ký quỹ qua PayPal" },
    { at: now - 30 * DAY, by: nebula.id, text: "Creator đã bàn giao sản phẩm hoàn thiện (có watermark)" },
    { at: now - 29 * DAY, by: customer.id, text: "Khách hàng đã chấp nhận sản phẩm — tiền được giải ngân cho creator" },
  );
  nebula.balance = Math.round(o3.total * 0.9);

  const o4 = makeOrder(
    {
      customerId: customerB.id,
      creatorId: 1,
      title: "Cyberpunk Hacker Girl",
      brief: "Thiết kế nhân vật theo phong cách cyberpunk với màu sắc neon chủ đạo. Nhân vật là một hacker nữ với outfit tương lai.",
      details: "Cần có cả full body và close-up portrait.",
      colorNotes: "Neon tím - xanh cyan",
      status: "pending",
      options: { format: "fullColor", bodyType: "fullBody", extraCharacters: 0, background: true },
    },
    now - 2 * HOUR,
  );

  const orders = [o1, o2, o3, o4];
  const transactions: Transaction[] = [o1, o2, o3].map((o) => ({
    id: uid(),
    userId: o.customerId,
    type: "escrow_hold",
    amount: -o.total,
    orderId: o.id,
    note: `Ký quỹ đơn ${o.code}`,
    createdAt: o.payment!.paidAt,
  }));
  transactions.push({
    id: uid(),
    userId: nebula.id,
    type: "escrow_release",
    amount: Math.round(o3.total * 0.9),
    orderId: o3.id,
    note: `Giải ngân đơn ${o3.code} (đã trừ 10% phí sàn)`,
    createdAt: now - 29 * DAY,
  });
  transactions.push({
    id: uid(),
    userId: luna.id,
    type: "escrow_release",
    amount: 8_400_000,
    orderId: null,
    note: "Giải ngân các đơn tháng trước",
    createdAt: now - 20 * DAY,
  });

  // ---- Messages -------------------------------------------------------------
  const messages: Message[] = [];
  const say = (from: User, to: User, text: string, at: number, extra: Partial<Message> = {}) =>
    messages.push({ id: uid(), conversationId: conversationIdOf(from.id, to.id), senderId: from.id, text, image: "", orderId: null, createdAt: at, readBy: [from.id], ...extra });
  say(customer, luna, "Chào bạn! Mình vừa gửi yêu cầu commission Character Design, bạn xem giúp mình nhé", now - 6 * DAY);
  say(luna, customer, "Chào bạn! Mình nhận được rồi, concept rất hay đấy. Mình chốt đơn nhé!", now - 5.6 * DAY, { readBy: [luna.id, customer.id] });
  say(customer, luna, "Mình đã thanh toán ký quỹ rồi nha 🙌", now - 5 * DAY, { readBy: [customer.id, luna.id] });
  say(luna, customer, "Sketch tư thế đầu tiên, bạn xem thử nhé!", now - 2 * DAY, { image: o1.drafts[0]!.image, orderId: o1.id });
  say(starlight, customer, "Bản hoàn thiện đây ạ! Bạn kiểm tra giúp mình nhé 💕", now - 3 * HOUR, { orderId: o2.id });
  say(nebula, customer, "Cảm ơn bạn đã đánh giá 5 sao nha!", now - 29 * DAY, { readBy: [nebula.id, customer.id] });
  say(customerB, luna, "Hi Luna, mình mới gửi yêu cầu Cyberpunk Hacker Girl, mong bạn nhận đơn 🥺", now - 2 * HOUR);

  // ---- Notifications --------------------------------------------------------
  const notifications: Notification[] = [];
  const notify = (user: User, n: Omit<Notification, "id" | "userId" | "isRead"> & { isRead?: boolean }) =>
    notifications.push({ id: uid(), userId: user.id, isRead: false, ...n });
  notify(customer, { type: "order", title: "Sản phẩm đã được bàn giao", message: `Starlight Painter đã bàn giao "${o2.title}". Hãy kiểm tra và chấp nhận sản phẩm.`, link: `/orders/${o2.id}`, createdAt: now - 3 * HOUR });
  notify(customer, { type: "order", title: "Bản nháp mới", message: `Luna Artwork đã gửi bản nháp cho "${o1.title}"`, link: `/orders/${o1.id}`, createdAt: now - 2 * DAY });
  notify(customer, { type: "system", title: "Cập nhật Monthly Creator", message: "Danh sách Top Creators tháng này đã được cập nhật. Xem ngay những tài năng mới!", link: "/find-creators", createdAt: now - 3 * DAY, isRead: true });
  notify(luna, { type: "order", title: "Yêu cầu commission mới", message: `Trần Thị B đã gửi yêu cầu "${o4.title}"`, link: `/orders/${o4.id}`, createdAt: now - 2 * HOUR });
  notify(luna, { type: "payment", title: "Khách hàng đã ký quỹ", message: `Đơn "${o1.title}" đã được ký quỹ thành công. Bạn có thể bắt đầu thực hiện.`, link: `/orders/${o1.id}`, createdAt: now - 5 * DAY, isRead: true });
  notify(admin, { type: "creator", title: "Hồ sơ creator mới", message: "Trần Thị B đã nộp hồ sơ đăng ký creator", link: "/admin", createdAt: now - 1 * DAY });
  notify(admin, { type: "payment", title: "Yêu cầu rút tiền", message: "Luna Artwork yêu cầu rút 2.000.000 VND", link: "/admin", createdAt: now - 1 * DAY });

  // ---- Social ---------------------------------------------------------------
  const posts: Post[] = [];
  for (const id of [1, 2, 3, 4, 5, 6]) {
    const author = creatorUser(id);
    POST_TEMPLATES.forEach((t, i) =>
      posts.push({ id: uid(), authorId: author.id, content: t.content, image: t.image, likes: [], comments: [], createdAt: now - (i * 2 + id) * DAY }),
    );
  }
  posts.push({ id: uid(), authorId: customer.id, content: "Vừa nhận được art OC từ Nebula Arts, đẹp xỉu 😍", image: o3.delivery!.preview, likes: [nebula.id], comments: [{ id: uid(), authorId: nebula.id, text: "Cảm ơn bạn nhiều nha!", at: now - 28 * DAY }], createdAt: now - 28 * DAY });

  const reels: Reel[] = REEL_SEED.map((r, i) => ({
    id: uid(),
    authorId: creatorUser(r.creator).id,
    title: r.title,
    thumbnail: r.thumbnail,
    videoUrl: "",
    duration: r.duration,
    likes: [],
    views: r.views,
    createdAt: now - (i + 1) * DAY,
  }));

  return {
    version: 1,
    users,
    creators,
    applications: [
      {
        id: uid(),
        userId: customerB.id,
        displayName: "Moonlight Quill",
        type: "Writer",
        specialty: "Dark Fantasy Short Story",
        bio: "Viết truyện ngắn, plot cho OC, worldbuilding fantasy.",
        tags: ["Dark Fantasy", "Romance", "Mystery"],
        portfolioUrl: "https://example.com/moonlight-quill",
        samples: ["https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=600&fit=crop"],
        legalName: "Trần Thị B",
        idNumber: "079200001234",
        priceList: PRICE_TIERS.low,
        status: "pending",
        adminNote: "",
        createdAt: now - 1 * DAY,
        reviewedAt: null,
      },
    ],
    orders,
    messages,
    notifications,
    transactions,
    withdrawals: [
      { id: uid(), userId: luna.id, amount: 2_000_000, method: "bank", account: "Vietcombank - 0123456789 - LUNA ARTWORK", status: "pending", createdAt: now - 1 * DAY, reviewedAt: null },
    ],
    posts,
    reels,
    follows: [
      { userId: customer.id, creatorId: 1, createdAt: now - 10 * DAY },
      { userId: customer.id, creatorId: 3, createdAt: now - 40 * DAY },
    ],
    codes: [],
    files: [
      { id: o2File, ownerId: starlight.id, dataUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=2000&h=2000&fit=crop", name: "pastel-couple.jpg" },
      { id: o3File, ownerId: nebula.id, dataUrl: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=2000&h=2000&fit=crop", name: "cyberpunk-samurai.jpg" },
    ],
    platformRevenue: Math.round(o3.total * 0.1),
  };
}
