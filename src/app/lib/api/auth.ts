import { generateOtp, generateSalt, hashPassword } from "../crypto";
import { getDb, mutate, uid } from "../db";
import type { User } from "../types";
import { ApiError, delay, pushNotification, requireUser, setSession } from "./core";

const CODE_TTL = 10 * 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Mật khẩu phải có cả chữ và số";
  return null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function findByEmail(email: string) {
  return getDb().users.find((u) => u.email === normalizeEmail(email)) ?? null;
}

/**
 * Issues a one-time code. There is no mail server, so the code is returned to
 * the caller which surfaces it in a simulated inbox.
 */
function issueCode(email: string, purpose: "verify" | "reset") {
  const code = generateOtp();
  mutate((db) => {
    db.codes = db.codes.filter((c) => !(c.email === email && c.purpose === purpose));
    db.codes.push({ email, purpose, code, expiresAt: Date.now() + CODE_TTL });
  });
  return code;
}

function consumeCode(email: string, purpose: "verify" | "reset", code: string) {
  const db = getDb();
  const entry = db.codes.find((c) => c.email === email && c.purpose === purpose);
  if (!entry || entry.code !== code.trim()) throw new ApiError("Mã xác thực không đúng");
  if (entry.expiresAt < Date.now()) throw new ApiError("Mã xác thực đã hết hạn, vui lòng gửi lại");
  mutate((d) => {
    d.codes = d.codes.filter((c) => c !== entry);
  });
}

export async function register(input: { fullName: string; email: string; phone?: string; password: string }) {
  await delay();
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  if (fullName.length < 2) throw new ApiError("Vui lòng nhập họ tên");
  if (!EMAIL_RE.test(email)) throw new ApiError("Email không hợp lệ");
  const pwError = validatePassword(input.password);
  if (pwError) throw new ApiError(pwError);
  const existing = findByEmail(email);
  if (existing?.emailVerified) throw new ApiError("Email này đã được đăng ký");

  const salt = generateSalt();
  const passwordHash = await hashPassword(input.password, salt);
  mutate((db) => {
    // An unverified account with the same email is replaced by the new sign-up.
    db.users = db.users.filter((u) => u.email !== email);
    const user: User = {
      id: uid(),
      email,
      passwordHash,
      salt,
      fullName,
      avatar: "",
      bio: "",
      phone: input.phone?.trim() ?? "",
      role: "user",
      emailVerified: false,
      creatorStatus: "none",
      creatorId: null,
      balance: 0,
      createdAt: Date.now(),
    };
    db.users.push(user);
  });
  return { email, code: issueCode(email, "verify") };
}

export async function resendVerification(email: string) {
  await delay();
  const user = findByEmail(email);
  if (!user) throw new ApiError("Không tìm thấy tài khoản với email này");
  if (user.emailVerified) throw new ApiError("Tài khoản đã được xác thực");
  return issueCode(user.email, "verify");
}

export async function verifyEmail(email: string, code: string) {
  await delay();
  const user = findByEmail(email);
  if (!user) throw new ApiError("Không tìm thấy tài khoản");
  consumeCode(user.email, "verify", code);
  mutate((db) => {
    const u = db.users.find((x) => x.id === user.id)!;
    u.emailVerified = true;
    pushNotification({
      userId: u.id,
      type: "system",
      title: "Chào mừng đến với Asmorius! 🎉",
      message: "Tài khoản của bạn đã được xác thực. Khám phá các creator tài năng ngay nhé.",
      link: "/find-creators",
    });
  });
}

export async function login(email: string, password: string, remember: boolean) {
  await delay(350);
  const user = findByEmail(email);
  if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) {
    throw new ApiError("Email hoặc mật khẩu không đúng");
  }
  if (!user.emailVerified) {
    const code = issueCode(user.email, "verify");
    return { needsVerification: true as const, email: user.email, code };
  }
  setSession(user.id, remember);
  return { needsVerification: false as const, user };
}

export function logout() {
  setSession(null);
}

export async function requestPasswordReset(email: string) {
  await delay();
  const user = findByEmail(email);
  if (!user) throw new ApiError("Không tìm thấy tài khoản với email này");
  return issueCode(user.email, "reset");
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  await delay();
  const user = findByEmail(email);
  if (!user) throw new ApiError("Không tìm thấy tài khoản");
  const pwError = validatePassword(newPassword);
  if (pwError) throw new ApiError(pwError);
  consumeCode(user.email, "reset", code);
  const salt = generateSalt();
  const passwordHash = await hashPassword(newPassword, salt);
  mutate((db) => {
    const u = db.users.find((x) => x.id === user.id)!;
    u.salt = salt;
    u.passwordHash = passwordHash;
    u.emailVerified = true;
  });
}

export async function changePassword(current: string, next: string) {
  await delay();
  const user = requireUser();
  if ((await hashPassword(current, user.salt)) !== user.passwordHash) {
    throw new ApiError("Mật khẩu hiện tại không đúng");
  }
  const pwError = validatePassword(next);
  if (pwError) throw new ApiError(pwError);
  const salt = generateSalt();
  const passwordHash = await hashPassword(next, salt);
  mutate(() => {
    user.salt = salt;
    user.passwordHash = passwordHash;
  });
}

export async function updateProfile(patch: Partial<Pick<User, "fullName" | "bio" | "phone" | "avatar">>) {
  await delay();
  const user = requireUser();
  if (patch.fullName !== undefined && patch.fullName.trim().length < 2) {
    throw new ApiError("Vui lòng nhập họ tên");
  }
  mutate((db) => {
    Object.assign(user, patch, patch.fullName ? { fullName: patch.fullName.trim() } : {});
    // Keep the public creator card in sync with the account.
    const creator = user.creatorId ? db.creators.find((c) => c.id === user.creatorId) : null;
    if (creator) {
      if (patch.avatar) creator.image = patch.avatar;
    }
  });
}
