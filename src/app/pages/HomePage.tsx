import { useState, useEffect } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, Star, TrendingUp, ShieldCheck, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useDb } from "../lib/db";
import { priceRangeLabel } from "../lib/pricing";
import { useAuth } from "../context/AuthContext";
import type { Creator } from "../lib/types";

const FEATURED_TAGS = ["Dark Fantasy", "Pastel", "Cyberpunk", "Anime", "Chibi", "Watercolor", "Gothic", "Character Design"];

function ExhibitionCarousel({ title, data }: { title: string; data: (Creator & { category: string; priceRange: string })[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (data.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % data.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [data.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + data.length) % data.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % data.length);
  };

  if (data.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <h2 className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          {title}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            aria-label="Trước"
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            aria-label="Tiếp"
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <Link to={`/creator/${data[currentIndex].id}`}>
        <div className="relative h-[320px] sm:h-[400px] overflow-hidden rounded-2xl cursor-pointer group">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <div className="relative h-full bg-gradient-to-br from-primary/10 to-purple-600/10 rounded-2xl overflow-hidden border border-border">
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                <img
                  src={data[currentIndex].image}
                  alt={data[currentIndex].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute bottom-0 left-0 right-0 p-6 pb-10 sm:p-8 sm:pb-10 bg-gradient-to-t from-black/80 to-transparent text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-primary rounded-full text-sm">
                      {data[currentIndex].category}
                    </span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{data[currentIndex].rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold mb-2">{data[currentIndex].name}</h3>
                  <p className="text-lg text-white/90 mb-2">{data[currentIndex].specialty}</p>
                  <p className="text-white/70">{data[currentIndex].commissions} commissions hoàn thành</p>
                  <p className="text-yellow-400 font-semibold mt-2">{data[currentIndex].priceRange}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {data.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentIndex(index);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? "bg-white w-8" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      </Link>
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const { top, stats } = useDb((db) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    // Monthly chart: completed orders this month weigh in on top of rating.
    const monthly = new Map<number, number>();
    db.orders.forEach((o) => {
      if (o.status === "completed" && o.updatedAt >= monthStart) monthly.set(o.creatorId, (monthly.get(o.creatorId) ?? 0) + 1);
    });
    const top = [...db.creators]
      .sort((a, b) => b.rating + (monthly.get(b.id) ?? 0) * 0.05 - (a.rating + (monthly.get(a.id) ?? 0) * 0.05) || b.commissions - a.commissions)
      .slice(0, 5)
      .map((c) => ({ ...c, category: c.type, priceRange: priceRangeLabel(c.priceList) }));
    const completed = db.creators.reduce((sum, c) => sum + c.commissions, 0);
    const rated = db.creators.filter((c) => c.ratingCount > 0);
    const avg = rated.reduce((s, c) => s + c.rating, 0) / Math.max(1, rated.length);
    return {
      top,
      stats: {
        creators: db.creators.length,
        completed,
        satisfaction: Math.round((avg / 5) * 100),
      },
    };
  });

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Hero Section */}
      <section className="text-center py-8 sm:py-12 space-y-6">
        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary via-purple-600 to-pink-500 bg-clip-text text-transparent leading-tight">
          {user ? `Xin chào, ${user.fullName.split(" ").slice(-1)[0]}!` : "Chào mừng đến với Asmorius"}
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          Nền tảng kết nối Artists, Writers và khách hàng. Biến OC, couple và plot của bạn thành hiện thực — thanh toán an toàn với ký quỹ escrow.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link to="/find-creators" className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Khám phá ngay
          </Link>
          <a href="#how-it-works" className="px-8 py-3 border border-border rounded-lg hover:bg-secondary transition-colors">
            Tìm hiểu thêm
          </a>
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {FEATURED_TAGS.map((tag) => (
            <Link key={tag} to={`/find-creators?tag=${encodeURIComponent(tag)}`} className="px-3 py-1 text-sm rounded-full bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
              #{tag}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-6 bg-card rounded-xl border border-border text-center space-y-2">
          <div className="text-4xl font-bold text-primary">{stats.creators.toLocaleString("vi-VN")}+</div>
          <div className="text-muted-foreground">Creators tài năng</div>
        </div>
        <div className="p-6 bg-card rounded-xl border border-border text-center space-y-2">
          <div className="text-4xl font-bold text-primary">{stats.completed.toLocaleString("vi-VN")}+</div>
          <div className="text-muted-foreground">Commissions hoàn thành</div>
        </div>
        <div className="p-6 bg-card rounded-xl border border-border text-center space-y-2">
          <div className="text-4xl font-bold text-primary">{stats.satisfaction}%</div>
          <div className="text-muted-foreground">Khách hàng hài lòng</div>
        </div>
      </section>

      {/* Monthly Exhibitions */}
      <section>
        <ExhibitionCarousel title="Top Creators tháng này" data={top} />
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-8 sm:py-12 space-y-8 scroll-mt-20">
        <h2 className="text-center">Cách thức hoạt động</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { title: "Tìm Creator phù hợp", text: "Xem Monthly Chart hoặc lọc theo tag phong cách và mức giá phù hợp ngân sách" },
            { title: "Gửi brief & Thảo luận", text: "Điền form yêu cầu (brief, chi tiết, màu sắc) và trao đổi trực tiếp qua chat nội bộ" },
            { title: "Ký quỹ an toàn", text: "Thanh toán qua MoMo, ZaloPay, PayPal — tiền được giữ tại ví trung gian của sàn" },
            { title: "Nghiệm thu & Đánh giá", text: "Xem bản nháp, nhận file có watermark, chấp nhận để mở khóa file sạch" },
          ].map((step, i) => (
            <div key={step.title} className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary text-2xl font-bold">{i + 1}</div>
              <h3>{step.title}</h3>
              <p className="text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust + creator CTA */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 rounded-2xl border border-border bg-card space-y-3">
          <ShieldCheck className="w-10 h-10 text-primary" />
          <h3>Bảo vệ cả hai phía</h3>
          <p className="text-muted-foreground">
            Khách hàng chỉ giải ngân khi hài lòng. Creator yên tâm làm việc vì tiền đã được ký quỹ. Có tranh chấp? Đội ngũ Admin xử lý dựa trên lịch sử chat và brief.
          </p>
        </div>
        <div className="p-8 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-purple-600/10 space-y-3">
          <Sparkles className="w-10 h-10 text-primary" />
          <h3>Bạn là Artist hoặc Writer?</h3>
          <p className="text-muted-foreground">Mở cửa hàng, thiết lập bảng giá và nhận 90% giá trị mỗi đơn hàng.</p>
          <Link to="/become-creator" className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Trở thành Creator
          </Link>
        </div>
      </section>
    </div>
  );
}
