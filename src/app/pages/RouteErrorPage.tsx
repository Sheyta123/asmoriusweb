import { Link, useRouteError } from "react-router";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export function RouteErrorPage() {
  const error = useRouteError() as Error | undefined;
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md text-center space-y-5 bg-card rounded-2xl border border-border p-8 shadow-xl">
        <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1>Đã có lỗi xảy ra</h1>
        <p className="text-muted-foreground">Trang này gặp sự cố ngoài ý muốn. Bạn thử tải lại hoặc quay về trang chủ nhé.</p>
        {error?.message && <p className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-2 break-words">{error.message}</p>}
        <div className="flex gap-3 justify-center">
          <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg hover:bg-secondary">
            <RotateCcw className="w-4 h-4" /> Tải lại
          </button>
          <Link to="/" reloadDocument className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            <Home className="w-4 h-4" /> Trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
