import { getDb, mutate, uid } from "../db";
import { conversationIdOf, orderCode } from "../ids";
import { MAX_FREE_REVISIONS, PLATFORM_FEE_RATE, computeTotal, formatVND } from "../pricing";
import type { Order, OrderOptions, OrderStatus, PaymentMethod, User } from "../types";
import { ApiError, delay, pushNotification, requireAdmin, requireUser } from "./core";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "momo", label: "Ví MoMo", hint: "Quét mã QR bằng ứng dụng MoMo" },
  { value: "zalopay", label: "ZaloPay", hint: "Thanh toán qua ví ZaloPay" },
  { value: "paypal", label: "PayPal", hint: "Thanh toán quốc tế qua PayPal" },
  { value: "bank", label: "Chuyển khoản ngân hàng", hint: "Napas 24/7 — xác nhận tức thì" },
];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  momo: "MoMo",
  zalopay: "ZaloPay",
  paypal: "PayPal",
  bank: "Chuyển khoản",
};

function getOrder(id: string) {
  const order = getDb().orders.find((o) => o.id === id);
  if (!order) throw new ApiError("Không tìm thấy đơn hàng");
  return order;
}

function assertStatus(order: Order, ...allowed: OrderStatus[]) {
  if (!allowed.includes(order.status)) {
    throw new ApiError("Trạng thái đơn hàng đã thay đổi, vui lòng tải lại trang");
  }
}

function asCustomer(order: Order, user: User) {
  if (order.customerId !== user.id) throw new ApiError("Chỉ khách hàng của đơn mới thực hiện được thao tác này");
}

function asCreator(order: Order, user: User) {
  if (order.creatorUserId !== user.id) throw new ApiError("Chỉ creator của đơn mới thực hiện được thao tác này");
}

function log(order: Order, by: string, text: string) {
  order.events.push({ at: Date.now(), by, text });
  order.updatedAt = Date.now();
}

/** Posts a system line into the customer ↔ creator conversation. */
function systemMessage(order: Order, text: string, image = "") {
  getDb().messages.push({
    id: uid(),
    conversationId: conversationIdOf(order.customerId, order.creatorUserId),
    senderId: "system",
    text,
    image,
    orderId: order.id,
    createdAt: Date.now(),
    readBy: [],
  });
}

function notifyUser(userId: string, order: Order, title: string, message: string, type: "order" | "payment" = "order") {
  pushNotification({ userId, type, title, message, link: `/orders/${order.id}` });
}

export interface CreateOrderInput {
  creatorId: number;
  title: string;
  brief: string;
  details: string;
  colorNotes: string;
  references: string[];
  deadline: string;
  options: OrderOptions;
}

export async function createOrder(input: CreateOrderInput) {
  await delay(400);
  const user = requireUser();
  const db = getDb();
  const creator = db.creators.find((c) => c.id === input.creatorId);
  if (!creator) throw new ApiError("Creator không tồn tại");
  if (creator.userId === user.id) throw new ApiError("Bạn không thể đặt commission của chính mình");
  if (!creator.isOpen) throw new ApiError("Creator hiện đang tạm đóng nhận commission");
  if (input.title.trim().length < 3) throw new ApiError("Vui lòng nhập tiêu đề commission");
  if (input.brief.trim().length < 10) throw new ApiError("Brief cần mô tả tối thiểu 10 ký tự");
  if (!input.deadline) throw new ApiError("Vui lòng chọn deadline");
  if (new Date(input.deadline).getTime() < Date.now()) throw new ApiError("Deadline phải sau ngày hôm nay");

  const now = Date.now();
  const order: Order = {
    id: uid(),
    code: orderCode(db.orders.length + 1),
    customerId: user.id,
    creatorId: creator.id,
    creatorUserId: creator.userId,
    title: input.title.trim(),
    brief: input.brief.trim(),
    details: input.details.trim(),
    colorNotes: input.colorNotes.trim(),
    references: input.references,
    deadline: input.deadline,
    options: input.options,
    total: computeTotal(creator.priceList, input.options),
    status: "pending",
    rejectReason: "",
    payment: null,
    drafts: [],
    delivery: null,
    revisionCount: 0,
    dispute: null,
    review: null,
    events: [{ at: now, by: user.id, text: "Khách hàng đã gửi yêu cầu commission" }],
    createdAt: now,
    updatedAt: now,
  };
  mutate((d) => {
    d.orders.push(order);
    systemMessage(order, `📋 ${user.fullName} đã gửi yêu cầu commission "${order.title}" (${formatVND(order.total)}). Hãy trao đổi chi tiết tại đây.`);
    notifyUser(creator.userId, order, "Yêu cầu commission mới", `${user.fullName} đã gửi yêu cầu "${order.title}"`);
  });
  return order;
}

export async function cancelOrder(id: string) {
  await delay();
  const user = requireUser();
  const order = getOrder(id);
  asCustomer(order, user);
  assertStatus(order, "pending", "accepted");
  mutate(() => {
    order.status = "cancelled";
    log(order, user.id, "Khách hàng đã hủy yêu cầu");
    systemMessage(order, `❌ Khách hàng đã hủy yêu cầu "${order.title}"`);
    notifyUser(order.creatorUserId, order, "Đơn hàng đã bị hủy", `Khách hàng đã hủy "${order.title}"`);
  });
}

export async function acceptOrder(id: string, adjustedTotal?: number) {
  await delay();
  const user = requireUser();
  const order = getOrder(id);
  asCreator(order, user);
  assertStatus(order, "pending");
  if (adjustedTotal !== undefined && (!Number.isFinite(adjustedTotal) || adjustedTotal < 50000)) {
    throw new ApiError("Giá chốt tối thiểu là 50.000 VND");
  }
  mutate(() => {
    const changed = adjustedTotal !== undefined && adjustedTotal !== order.total;
    if (changed) order.total = Math.round(adjustedTotal!);
    order.status = "accepted";
    log(order, user.id, changed ? `Creator đã chốt đơn với giá ${formatVND(order.total)}` : "Creator đã chấp nhận và chốt đơn");
    systemMessage(order, `✅ Creator đã chốt đơn với giá ${formatVND(order.total)}. Vui lòng thanh toán ký quỹ để creator bắt đầu.`);
    notifyUser(order.customerId, order, "Creator đã nhận đơn", `"${order.title}" đã được chốt với giá ${formatVND(order.total)}. Hãy thanh toán ký quỹ.`);
  });
}

export async function rejectOrder(id: string, reason: string) {
  await delay();
  const user = requireUser();
  const order = getOrder(id);
  asCreator(order, user);
  assertStatus(order, "pending", "accepted");
  mutate(() => {
    order.status = "rejected";
    order.rejectReason = reason.trim();
    log(order, user.id, `Creator đã từ chối đơn${reason.trim() ? `: ${reason.trim()}` : ""}`);
    systemMessage(order, `🚫 Creator đã từ chối yêu cầu "${order.title}"${reason.trim() ? ` — Lý do: ${reason.trim()}` : ""}`);
    notifyUser(order.customerId, order, "Yêu cầu bị từ chối", `Creator đã từ chối "${order.title}"`);
  });
}

export async function payOrder(id: string, method: PaymentMethod) {
  await delay(900);
  const user = requireUser();
  const order = getOrder(id);
  asCustomer(order, user);
  assertStatus(order, "accepted");
  mutate((db) => {
    const now = Date.now();
    order.status = "in_progress";
    order.payment = { method, amount: order.total, paidAt: now };
    db.transactions.push({
      id: uid(),
      userId: user.id,
      type: "escrow_hold",
      amount: -order.total,
      orderId: order.id,
      note: `Ký quỹ đơn ${order.code} qua ${PAYMENT_LABELS[method]}`,
      createdAt: now,
    });
    log(order, user.id, `Đã thanh toán ký quỹ qua ${PAYMENT_LABELS[method]}`);
    systemMessage(order, `🔒 Khách hàng đã ký quỹ ${formatVND(order.total)}. Tiền được giữ an toàn tại ví trung gian của Asmorius.`);
    notifyUser(order.creatorUserId, order, "Khách hàng đã ký quỹ", `Đơn "${order.title}" đã được ký quỹ thành công. Bạn có thể bắt đầu thực hiện.`, "payment");
  });
}

export async function submitDraft(id: string, image: string, note: string) {
  await delay();
  const user = requireUser();
  const order = getOrder(id);
  asCreator(order, user);
  assertStatus(order, "in_progress");
  if (!image) throw new ApiError("Vui lòng tải lên bản nháp");
  mutate((db) => {
    order.drafts.push({ image, note: note.trim(), at: Date.now() });
    log(order, user.id, "Creator đã gửi bản nháp");
    db.messages.push({
      id: uid(),
      conversationId: conversationIdOf(order.customerId, order.creatorUserId),
      senderId: user.id,
      text: note.trim() || `Bản nháp cho "${order.title}"`,
      image,
      orderId: order.id,
      createdAt: Date.now(),
      readBy: [user.id],
    });
    notifyUser(order.customerId, order, "Bản nháp mới", `${user.fullName} đã gửi bản nháp cho "${order.title}"`);
  });
}

export async function deliverOrder(id: string, input: { preview: string; clean: string; fileName: string; note: string }) {
  await delay(500);
  const user = requireUser();
  const order = getOrder(id);
  asCreator(order, user);
  assertStatus(order, "in_progress");
  mutate((db) => {
    const fileId = uid();
    db.files.push({ id: fileId, ownerId: user.id, dataUrl: input.clean, name: input.fileName });
    order.delivery = { preview: input.preview, fileId, note: input.note.trim(), at: Date.now() };
    order.status = "delivered";
    log(order, user.id, "Creator đã bàn giao sản phẩm hoàn thiện (có watermark)");
    systemMessage(order, `📦 Creator đã bàn giao sản phẩm hoàn thiện cho "${order.title}". Bản xem trước có watermark — hãy chấp nhận để nhận file sạch.`, input.preview);
    notifyUser(order.customerId, order, "Sản phẩm đã được bàn giao", `${user.fullName} đã bàn giao "${order.title}". Hãy kiểm tra và chấp nhận sản phẩm.`);
  });
}

export async function requestRevision(id: string, note: string) {
  await delay();
  const user = requireUser();
  const order = getOrder(id);
  asCustomer(order, user);
  assertStatus(order, "delivered");
  if (order.revisionCount >= MAX_FREE_REVISIONS) {
    throw new ApiError(`Đã hết ${MAX_FREE_REVISIONS} lần chỉnh sửa miễn phí. Bạn có thể chấp nhận hoặc khiếu nại.`);
  }
  if (note.trim().length < 5) throw new ApiError("Vui lòng mô tả điểm cần chỉnh sửa");
  mutate(() => {
    order.status = "in_progress";
    order.revisionCount += 1;
    log(order, user.id, `Khách hàng yêu cầu chỉnh sửa (lần ${order.revisionCount}): ${note.trim()}`);
    systemMessage(order, `✏️ Yêu cầu chỉnh sửa lần ${order.revisionCount}: ${note.trim()}`);
    notifyUser(order.creatorUserId, order, "Yêu cầu chỉnh sửa", `Khách hàng yêu cầu chỉnh sửa "${order.title}"`);
  });
}

function releaseFunds(order: Order, note: string) {
  const db = getDb();
  const creatorUser = db.users.find((u) => u.id === order.creatorUserId)!;
  const fee = Math.round(order.total * PLATFORM_FEE_RATE);
  const payout = order.total - fee;
  creatorUser.balance += payout;
  db.platformRevenue += fee;
  const creator = db.creators.find((c) => c.id === order.creatorId);
  if (creator) creator.commissions += 1;
  db.transactions.push({
    id: uid(),
    userId: creatorUser.id,
    type: "escrow_release",
    amount: payout,
    orderId: order.id,
    note: `${note} — đơn ${order.code} (đã trừ ${PLATFORM_FEE_RATE * 100}% phí sàn: ${formatVND(fee)})`,
    createdAt: Date.now(),
  });
  return payout;
}

export async function approveOrder(id: string) {
  await delay(500);
  const user = requireUser();
  const order = getOrder(id);
  asCustomer(order, user);
  assertStatus(order, "delivered");
  mutate(() => {
    order.status = "completed";
    const payout = releaseFunds(order, "Giải ngân");
    log(order, user.id, "Khách hàng đã chấp nhận sản phẩm — tiền được giải ngân cho creator");
    systemMessage(order, `🎉 Khách hàng đã chấp nhận sản phẩm "${order.title}". File sạch đã được mở khóa.`);
    notifyUser(order.creatorUserId, order, "Đơn hàng hoàn thành 🎉", `Khách hàng đã chấp nhận "${order.title}". ${formatVND(payout)} đã được cộng vào ví của bạn.`, "payment");
  });
}

export async function openDispute(id: string, reason: string) {
  await delay();
  const user = requireUser();
  const order = getOrder(id);
  asCustomer(order, user);
  assertStatus(order, "in_progress", "delivered");
  if (reason.trim().length < 10) throw new ApiError("Vui lòng mô tả lý do khiếu nại (tối thiểu 10 ký tự)");
  mutate((db) => {
    order.status = "disputed";
    order.dispute = { reason: reason.trim(), at: Date.now(), resolution: "", resolvedAt: null };
    log(order, user.id, `Khách hàng mở khiếu nại: ${reason.trim()}`);
    systemMessage(order, "⚠️ Khách hàng đã mở khiếu nại. Đội ngũ Admin sẽ xem xét dựa trên lịch sử chat và brief.");
    notifyUser(order.creatorUserId, order, "Đơn hàng bị khiếu nại", `Khách hàng đã khiếu nại "${order.title}". Admin sẽ liên hệ xử lý.`);
    db.users
      .filter((u) => u.role === "admin")
      .forEach((a) => pushNotification({ userId: a.id, type: "order", title: "Khiếu nại mới", message: `Đơn ${order.code} "${order.title}" cần xử lý`, link: "/admin?tab=disputes" }));
  });
}

export async function resolveDispute(id: string, outcome: "refund" | "release", resolution: string) {
  await delay();
  const admin = requireAdmin();
  const order = getOrder(id);
  assertStatus(order, "disputed");
  mutate((db) => {
    const text = resolution.trim() || (outcome === "refund" ? "Hoàn tiền cho khách hàng" : "Giải ngân cho creator");
    order.dispute!.resolution = text;
    order.dispute!.resolvedAt = Date.now();
    if (outcome === "refund") {
      order.status = "refunded";
      db.transactions.push({
        id: uid(),
        userId: order.customerId,
        type: "refund",
        amount: order.total,
        orderId: order.id,
        note: `Hoàn tiền ký quỹ đơn ${order.code}`,
        createdAt: Date.now(),
      });
    } else {
      order.status = "completed";
      releaseFunds(order, "Giải ngân sau khiếu nại");
    }
    log(order, admin.id, `Admin đã xử lý khiếu nại: ${text}`);
    systemMessage(order, `⚖️ Admin đã xử lý khiếu nại: ${text}`);
    [order.customerId, order.creatorUserId].forEach((uidTo) =>
      notifyUser(uidTo, order, "Khiếu nại đã được xử lý", `Đơn "${order.title}": ${text}`),
    );
  });
}

export async function reviewOrder(id: string, rating: number, comment: string) {
  await delay();
  const user = requireUser();
  const order = getOrder(id);
  asCustomer(order, user);
  assertStatus(order, "completed");
  if (order.review) throw new ApiError("Bạn đã đánh giá đơn hàng này");
  if (rating < 1 || rating > 5) throw new ApiError("Vui lòng chọn số sao");
  mutate((db) => {
    order.review = { rating, comment: comment.trim(), at: Date.now() };
    log(order, user.id, `Khách hàng đã đánh giá ${rating}★`);
    const creator = db.creators.find((c) => c.id === order.creatorId);
    if (creator) {
      const total = creator.rating * creator.ratingCount + rating;
      creator.ratingCount += 1;
      creator.rating = Math.round((total / creator.ratingCount) * 10) / 10;
    }
    notifyUser(order.creatorUserId, order, "Đánh giá mới", `${user.fullName} đã đánh giá ${rating}★ cho "${order.title}"`);
  });
}

export function getCleanFile(order: Order) {
  const user = requireUser();
  if (order.status !== "completed" || !order.delivery) throw new ApiError("File sạch chỉ mở khóa sau khi chấp nhận sản phẩm");
  if (user.id !== order.customerId && user.id !== order.creatorUserId && user.role !== "admin") {
    throw new ApiError("Bạn không có quyền tải file này");
  }
  const file = getDb().files.find((f) => f.id === order.delivery!.fileId);
  if (!file) throw new ApiError("Không tìm thấy file");
  return file;
}
