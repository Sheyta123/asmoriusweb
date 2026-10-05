import { createBrowserRouter, Navigate, useParams } from "react-router";
import type { ReactNode } from "react";
import { RootLayout } from "./layouts/RootLayout";
import { RequireAuth } from "./components/common";
import { HomePage } from "./pages/HomePage";
import { FindCreatorsPage } from "./pages/FindCreatorsPage";
import { ReelsPage } from "./pages/ReelsPage";
import { MessagesPage } from "./pages/MessagesPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { CreatorProfilePage } from "./pages/CreatorProfilePage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { WalletPage } from "./pages/WalletPage";
import { BecomeCreatorPage } from "./pages/BecomeCreatorPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminPage } from "./pages/AdminPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";

const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;

function LegacyRequestRedirect() {
  const { id } = useParams();
  return <Navigate to={`/orders/${id}`} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, Component: HomePage },
      { path: "find-creators", Component: FindCreatorsPage },
      { path: "reels", Component: ReelsPage },
      { path: "creator/:id", Component: CreatorProfilePage },
      { path: "messages", element: auth(<MessagesPage />) },
      { path: "notifications", element: auth(<NotificationsPage />) },
      { path: "profile", element: auth(<ProfilePage />) },
      { path: "orders", element: auth(<OrdersPage />) },
      { path: "orders/:id", element: auth(<OrderDetailPage />) },
      { path: "request/:id", Component: LegacyRequestRedirect },
      { path: "wallet", element: auth(<WalletPage />) },
      { path: "become-creator", element: auth(<BecomeCreatorPage />) },
      { path: "settings", element: auth(<SettingsPage />) },
      { path: "admin", element: <RequireAuth admin><AdminPage /></RequireAuth> },
    ],
  },
  { path: "/login", Component: LoginPage, ErrorBoundary: RouteErrorPage },
  { path: "/register", Component: RegisterPage, ErrorBoundary: RouteErrorPage },
  { path: "/verify-email", Component: VerifyEmailPage, ErrorBoundary: RouteErrorPage },
  { path: "/forgot-password", Component: ForgotPasswordPage, ErrorBoundary: RouteErrorPage },
  { path: "*", Component: NotFoundPage },
]);
