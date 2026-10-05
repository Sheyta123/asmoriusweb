import { getDb, mutate, uid } from "../db";
import type { Notification, PublicUser, User } from "../types";

export class ApiError extends Error {}

const SESSION_KEY = "asmorius_session";

/** Simulated network latency so loading states are exercised. */
export const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function safeGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function getSessionUserId(): string | null {
  return safeGet(localStorage, SESSION_KEY) ?? safeGet(sessionStorage, SESSION_KEY);
}

export function setSession(userId: string | null, remember = true) {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (userId) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, userId);
  } catch {
    // storage unavailable (private mode) — session lasts for this page only
  }
  window.dispatchEvent(new Event("asmorius-session"));
}

export function currentUser(): User | null {
  const id = getSessionUserId();
  return id ? (getDb().users.find((u) => u.id === id) ?? null) : null;
}

export function requireUser(): User {
  const user = currentUser();
  if (!user) throw new ApiError("Vui lòng đăng nhập để tiếp tục");
  return user;
}

export function requireAdmin(): User {
  const user = requireUser();
  if (user.role !== "admin") throw new ApiError("Bạn không có quyền thực hiện thao tác này");
  return user;
}

export function toPublic(user: User): PublicUser {
  const { passwordHash: _h, salt: _s, ...rest } = user;
  return rest;
}

export function findUser(id: string) {
  return getDb().users.find((u) => u.id === id) ?? null;
}

/** Inserts a notification; call inside or outside `mutate`. */
export function pushNotification(n: Omit<Notification, "id" | "isRead" | "createdAt">) {
  getDb().notifications.push({ ...n, id: uid(), isRead: false, createdAt: Date.now() });
}

export function markNotificationRead(id: string) {
  const user = requireUser();
  mutate((db) => {
    const n = db.notifications.find((x) => x.id === id && x.userId === user.id);
    if (n) n.isRead = true;
  });
}

export function markAllNotificationsRead() {
  const user = requireUser();
  mutate((db) => {
    db.notifications.forEach((n) => {
      if (n.userId === user.id) n.isRead = true;
    });
  });
}

export function deleteNotification(id: string) {
  const user = requireUser();
  mutate((db) => {
    db.notifications = db.notifications.filter((n) => !(n.id === id && n.userId === user.id));
  });
}
