import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Heart, Eye, Play, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { timeAgo } from "../lib/format";
import { createReel, toggleReelLike, viewReel } from "../lib/api/social";
import type { Reel } from "../lib/types";
import { Avatar, ImagePicker, Modal, Spinner, btnOutline, btnPrimary, inputClass, useAction } from "../components/common";

function embedUrl(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "iframe" as const, src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1` };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { kind: "video" as const, src: url };
  return null;
}

export function ReelsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const { reels, authors } = useDb((db) => {
    const authors = Object.fromEntries(
      db.users.map((u) => {
        const c = u.creatorId ? db.creators.find((x) => x.id === u.creatorId) : undefined;
        return [u.id, { name: c?.name ?? u.fullName, avatar: c?.image ?? u.avatar, creatorId: c?.id ?? null }];
      }),
    );
    return { reels: [...db.reels].sort((a, b) => b.createdAt - a.createdAt), authors };
  });
  const active = reels.find((r) => r.id === activeId);

  const open = (reel: Reel) => {
    viewReel(reel.id);
    setActiveId(reel.id);
  };

  const like = (reel: Reel) => {
    if (!user) {
      toast.info("Đăng nhập để thích Reel");
      navigate("/login?redirect=/reels");
      return;
    }
    toggleReelLike(reel.id);
  };

  const handleUploadCta = () => {
    if (!user) return navigate("/login?redirect=/reels");
    if (user.creatorStatus !== "approved") return navigate("/become-creator");
    setShowUpload(true);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="mb-2">Reels</h1>
        <p className="text-muted-foreground">Khám phá những video ngắn showcase từ các creators tài năng</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {reels.map((reel) => {
          const author = authors[reel.authorId];
          const liked = !!user && reel.likes.includes(user.id);
          return (
            <div key={reel.id} onClick={() => open(reel)} className="group cursor-pointer relative aspect-[9/16] rounded-xl overflow-hidden bg-card border border-border hover:shadow-lg transition-all">
              <img src={reel.thumbnail} alt={reel.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                  </div>
                </div>
                <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 text-white text-xs rounded">{reel.duration}</div>
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar src={author?.avatar} name={author?.name ?? "?"} className="w-8 h-8 border-2 border-white" />
                    <span className="text-white text-sm font-semibold truncate">{author?.name}</span>
                  </div>
                  <p className="text-white text-sm line-clamp-2">{reel.title}</p>
                  <div className="flex items-center gap-4 text-white text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        like(reel);
                      }}
                      className="flex items-center gap-1"
                      aria-label="Thích"
                    >
                      <Heart className={`w-4 h-4 ${liked ? "fill-pink-500 text-pink-500" : ""}`} />
                      <span>{reel.likes.length}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{reel.views.toLocaleString("vi-VN")}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 p-8 bg-gradient-to-br from-primary/10 to-purple-600/10 rounded-2xl border border-border text-center space-y-4">
        <h2>Bạn là creator?</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">Chia sẻ quá trình sáng tạo của bạn qua video ngắn và thu hút thêm nhiều khách hàng tiềm năng</p>
        <button onClick={handleUploadCta} className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2">
          <Play className="w-5 h-5" />
          {user?.creatorStatus === "approved" ? "Đăng Reel của bạn" : "Trở thành creator để đăng Reel"}
        </button>
      </div>

      <Modal open={!!active} onClose={() => setActiveId(null)} title={active?.title ?? ""} size="lg">
        {active && <ReelViewer reel={active} author={authors[active.authorId]} liked={!!user && active.likes.includes(user.id)} onLike={() => like(active)} />}
      </Modal>
      {showUpload && <UploadReelModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}

function ReelViewer({ reel, author, liked, onLike }: { reel: Reel; author?: { name: string; avatar: string; creatorId: number | null }; liked: boolean; onLike: () => void }) {
  const media = reel.videoUrl ? embedUrl(reel.videoUrl) : null;
  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-sm aspect-[9/16] rounded-xl overflow-hidden bg-black flex items-center justify-center">
        {media?.kind === "iframe" ? (
          <iframe src={media.src} title={reel.title} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
        ) : media?.kind === "video" ? (
          <video src={media.src} poster={reel.thumbnail} controls autoPlay className="w-full h-full object-contain" />
        ) : (
          <img src={reel.thumbnail} alt={reel.title} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex items-center gap-3">
        <Avatar src={author?.avatar} name={author?.name ?? "?"} className="w-10 h-10" />
        <div className="flex-1 min-w-0">
          {author?.creatorId ? (
            <Link to={`/creator/${author.creatorId}`} className="font-medium hover:underline">{author.name}</Link>
          ) : (
            <div className="font-medium">{author?.name}</div>
          )}
          <div className="text-xs text-muted-foreground">{timeAgo(reel.createdAt)} · {reel.views.toLocaleString("vi-VN")} lượt xem</div>
        </div>
        <button onClick={onLike} className={`${btnOutline} ${liked ? "text-pink-600 border-pink-300" : ""}`}>
          <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} /> {reel.likes.length}
        </button>
        {author?.creatorId && (
          <Link to={`/creator/${author.creatorId}`} className={btnPrimary}>Đặt commission</Link>
        )}
      </div>
    </div>
  );
}

function UploadReelModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState("");
  const { pending, run } = useAction();

  const submit = async () => {
    const ok = await run(async () => {
      await createReel({ title, thumbnail, videoUrl, duration });
      return true;
    }, "Đã đăng Reel!");
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Đăng Reel mới"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className={btnOutline}>Hủy</button>
          <button onClick={submit} disabled={pending} className={btnPrimary}>{pending && <Spinner className="w-4 h-4" />} Đăng</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block mb-2">Tiêu đề</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Speed painting OC mới" className={inputClass} />
        </div>
        <div>
          <label className="block mb-2">Ảnh bìa (tỉ lệ dọc 9:16)</label>
          {thumbnail && <img src={thumbnail} alt="Ảnh bìa" className="h-40 rounded-lg mb-2" />}
          <ImagePicker onPick={([u]) => setThumbnail(u!)} maxSize={900} className={`${btnOutline} w-full`}>
            <Upload className="w-4 h-4" /> {thumbnail ? "Đổi ảnh bìa" : "Chọn ảnh bìa"}
          </ImagePicker>
        </div>
        <div>
          <label className="block mb-2">Link video (YouTube/Shorts hoặc file .mp4)</label>
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/shorts/..." className={inputClass} />
        </div>
        <div>
          <label className="block mb-2">Thời lượng</label>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="1:20" className={inputClass} />
        </div>
      </div>
    </Modal>
  );
}
