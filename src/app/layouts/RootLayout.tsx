import { useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  Home,
  Search,
  PlaySquare,
  Bell,
  User,
  MessageSquare,
  ClipboardList,
  Wallet,
  Settings,
  Store,
  ShieldCheck,
  LogOut,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { formatVND } from "../lib/pricing";
import { Avatar } from "../components/common";
import { Logo } from "../components/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-semibold flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, creator, isAdmin, logout } = useAuth();

  const counts = useDb(
    (db) => {
      if (!user) return { messages: 0, notifications: 0 };
      return {
        messages: db.messages.filter((m) => m.conversationId.includes(user.id) && m.senderId !== user.id && !m.readBy.includes(user.id)).length,
        notifications: db.notifications.filter((n) => n.userId === user.id && !n.isRead).length,
      };
    },
    [user?.id],
  );

  // Braces matter: newer browsers return a Promise from scrollTo, which React
  // would otherwise try to call as the effect's cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const navItems = [
    { path: "/", label: "Trang chủ", short: "Trang chủ", icon: Home, badge: 0 },
    { path: "/find-creators", label: "Tìm Creators", short: "Tìm kiếm", icon: Search, badge: 0 },
    { path: "/reels", label: "Reels", short: "Reels", icon: PlaySquare, badge: 0 },
    { path: "/messages", label: "Tin nhắn", short: "Tin nhắn", icon: MessageSquare, badge: counts.messages },
    { path: "/notifications", label: "Bản tin Asmorius", short: "Bản tin", icon: Bell, badge: counts.notifications },
    { path: "/profile", label: "Trang cá nhân", short: "Cá nhân", icon: User, badge: 0 },
  ];

  const isActive = (path: string) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path));

  const handleLogout = () => {
    logout();
    toast.success("Đã đăng xuất");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4 xl:gap-8">
            <Logo />

            <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                      isActive(item.path) ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary hover:text-secondary-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                    <Badge count={item.badge} />
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3 flex-shrink-0">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar src={user.avatar} name={user.fullName} className="w-9 h-9" />
                    <span className="hidden md:block text-sm max-w-[120px] truncate">{user.fullName}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="font-normal">
                      <div className="font-medium truncate">{user.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      {user.creatorStatus === "approved" && (
                        <div className="mt-1 text-xs text-primary">Số dư ví: {formatVND(user.balance)}</div>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => navigate("/profile")}>
                      <User className="w-4 h-4" /> Trang cá nhân
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate("/orders")}>
                      <ClipboardList className="w-4 h-4" /> Đơn hàng của tôi
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate("/wallet")}>
                      <Wallet className="w-4 h-4" /> Ví & giao dịch
                    </DropdownMenuItem>
                    {creator ? (
                      <DropdownMenuItem onSelect={() => navigate(`/creator/${creator.id}`)}>
                        <Store className="w-4 h-4" /> Cửa hàng của tôi
                      </DropdownMenuItem>
                    ) : (
                      !isAdmin && (
                        <DropdownMenuItem onSelect={() => navigate("/become-creator")}>
                          <Sparkles className="w-4 h-4" /> Trở thành Creator
                        </DropdownMenuItem>
                      )
                    )}
                    <DropdownMenuItem onSelect={() => navigate("/settings")}>
                      <Settings className="w-4 h-4" /> Cài đặt tài khoản
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onSelect={() => navigate("/admin")}>
                        <ShieldCheck className="w-4 h-4" /> Quản trị hệ thống
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut className="w-4 h-4" /> Đăng xuất
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Link to="/login" className="hidden md:block px-4 py-2 text-sm text-primary hover:text-primary/80 transition-colors">
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap">
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 p-1 flex-1 min-w-0 ${isActive(item.path) ? "text-primary" : "text-muted-foreground"}`}
              >
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  <Badge count={item.badge} />
                </span>
                <span className="text-[11px] truncate max-w-full">{item.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="pb-20 lg:pb-0">
        <Outlet />
      </main>

      <footer className="hidden lg:block border-t border-border mt-12">
        <div className="container max-w-7xl mx-auto px-4 py-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Asmorius — Nền tảng commission cho Artists & Writers</span>
          <div className="flex gap-4">
            <Link to="/find-creators" className="hover:text-foreground">Tìm creator</Link>
            <Link to="/become-creator" className="hover:text-foreground">Trở thành creator</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
