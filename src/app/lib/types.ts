// Domain types shared by the data layer and the UI.

export type ID = string;

export type UserRole = "user" | "admin";
export type CreatorStatus = "none" | "pending" | "approved" | "rejected";

export interface User {
  id: ID;
  email: string;
  passwordHash: string;
  salt: string;
  fullName: string;
  avatar: string;
  bio: string;
  phone: string;
  role: UserRole;
  emailVerified: boolean;
  creatorStatus: CreatorStatus;
  creatorId: number | null;
  balance: number;
  createdAt: number;
}

/** User without credentials — safe to hand to UI components. */
export type PublicUser = Omit<User, "passwordHash" | "salt">;

export interface PriceList {
  sketch: number;
  baseColor: number;
  fullColor: number;
  shot: number;
  halfBody: number;
  fullBody: number;
  extraCharacter: number;
  background: number;
}

export interface Creator {
  id: number;
  userId: ID;
  name: string;
  type: "Artist" | "Writer";
  specialty: string;
  bio: string;
  rating: number;
  ratingCount: number;
  commissions: number;
  image: string;
  cover: string;
  tags: string[];
  priceList: PriceList;
  terms: string[];
  isOpen: boolean;
  createdAt: number;
}

export interface CreatorApplication {
  id: ID;
  userId: ID;
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
  status: "pending" | "approved" | "rejected";
  adminNote: string;
  createdAt: number;
  reviewedAt: number | null;
}

export type OrderStatus =
  | "pending" // customer sent brief, waiting for creator
  | "accepted" // creator agreed, waiting for escrow payment
  | "in_progress" // escrow paid, creator working
  | "delivered" // final file uploaded (watermarked preview)
  | "completed" // customer approved, funds released
  | "disputed" // customer opened a dispute
  | "refunded" // admin refunded customer
  | "rejected" // creator declined
  | "cancelled"; // customer cancelled before payment

export type PaymentMethod = "momo" | "zalopay" | "paypal" | "bank";

export interface OrderOptions {
  format: "sketch" | "baseColor" | "fullColor";
  bodyType: "shot" | "halfBody" | "fullBody";
  extraCharacters: number;
  background: boolean;
}

export interface OrderEvent {
  at: number;
  by: ID | "system";
  text: string;
}

export interface Order {
  id: ID;
  code: string;
  customerId: ID;
  creatorId: number;
  creatorUserId: ID;
  title: string;
  brief: string;
  details: string;
  colorNotes: string;
  references: string[];
  deadline: string;
  options: OrderOptions;
  total: number;
  status: OrderStatus;
  rejectReason: string;
  payment: { method: PaymentMethod; amount: number; paidAt: number } | null;
  drafts: { image: string; note: string; at: number }[];
  delivery: { preview: string; fileId: ID; note: string; at: number } | null;
  revisionCount: number;
  dispute: { reason: string; at: number; resolution: string; resolvedAt: number | null } | null;
  review: { rating: number; comment: string; at: number } | null;
  events: OrderEvent[];
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: ID;
  conversationId: string;
  senderId: ID | "system";
  text: string;
  image: string;
  orderId: ID | null;
  createdAt: number;
  readBy: ID[];
}

export type NotificationType =
  | "order"
  | "message"
  | "follow"
  | "system"
  | "payment"
  | "creator"
  | "post";

export interface Notification {
  id: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: number;
}

export type TransactionType =
  | "escrow_hold"
  | "escrow_release"
  | "platform_fee"
  | "refund"
  | "withdraw";

export interface Transaction {
  id: ID;
  userId: ID;
  type: TransactionType;
  amount: number;
  orderId: ID | null;
  note: string;
  createdAt: number;
}

export interface Withdrawal {
  id: ID;
  userId: ID;
  amount: number;
  method: "bank" | "paypal";
  account: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  reviewedAt: number | null;
}

export interface Post {
  id: ID;
  authorId: ID;
  content: string;
  image: string;
  likes: ID[];
  comments: { id: ID; authorId: ID; text: string; at: number }[];
  createdAt: number;
}

export interface Reel {
  id: ID;
  authorId: ID;
  title: string;
  thumbnail: string;
  videoUrl: string;
  duration: string;
  likes: ID[];
  views: number;
  createdAt: number;
}

export interface Follow {
  userId: ID;
  creatorId: number;
  createdAt: number;
}

/** One-time codes for email verification and password reset (simulated mailbox). */
export interface VerificationCode {
  email: string;
  purpose: "verify" | "reset";
  code: string;
  expiresAt: number;
}

/** Binary-ish blobs (clean deliverables) kept apart from the main tables. */
export interface StoredFile {
  id: ID;
  ownerId: ID;
  dataUrl: string;
  name: string;
}

export interface Database {
  version: number;
  users: User[];
  creators: Creator[];
  applications: CreatorApplication[];
  orders: Order[];
  messages: Message[];
  notifications: Notification[];
  transactions: Transaction[];
  withdrawals: Withdrawal[];
  posts: Post[];
  reels: Reel[];
  follows: Follow[];
  codes: VerificationCode[];
  files: StoredFile[];
  platformRevenue: number;
}
