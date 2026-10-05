import { Link } from "react-router";
import { Home, Search } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="text-center space-y-8 max-w-md">
        {/* 404 Illustration */}
        <div className="space-y-4">
          <div className="text-9xl font-bold bg-gradient-to-r from-primary via-purple-600 to-pink-500 bg-clip-text text-transparent">
            404
          </div>
          <h1>Trang không tồn tại</h1>
          <p className="text-muted-foreground">
            Xin lỗi, trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Về trang chủ
          </Link>
          <Link
            to="/find-creators"
            className="px-6 py-3 border border-border rounded-lg hover:bg-secondary transition-colors inline-flex items-center justify-center gap-2"
          >
            <Search className="w-5 h-5" />
            Tìm Creators
          </Link>
        </div>

        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
            <span className="font-bold text-white text-xl">A</span>
          </div>
          <span className="font-bold text-2xl bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Asmorius
          </span>
        </Link>
      </div>
    </div>
  );
}
