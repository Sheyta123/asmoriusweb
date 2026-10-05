import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Heart, MessageCircle, Trash2, ImagePlus, X, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useDb } from "../lib/db";
import { timeAgo } from "../lib/format";
import { addComment, createPost, deletePost, togglePostLike } from "../lib/api/social";
import type { Post } from "../lib/types";
import { Avatar, ImagePicker, Spinner } from "./common";

export function PostCard({ post }: { post: Post }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const people = useDb(
    (db) => {
      const ids = new Set([post.authorId, ...post.comments.map((c) => c.authorId)]);
      return Object.fromEntries(
        db.users
          .filter((u) => ids.has(u.id))
          .map((u) => [u.id, { name: u.fullName, avatar: u.avatar, creatorId: u.creatorId }]),
      );
    },
    [post.id, post.comments.length],
  );
  const author = people[post.authorId] ?? { name: "Người dùng", avatar: "", creatorId: null };
  const liked = !!user && post.likes.includes(user.id);
  const authorLink = author.creatorId ? `/creator/${author.creatorId}` : undefined;

  const requireLogin = () => {
    if (user) return true;
    toast.info("Đăng nhập để tương tác với bài đăng");
    navigate("/login");
    return false;
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireLogin() || !comment.trim()) return;
    addComment(post.id, comment);
    setComment("");
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <Avatar src={author.avatar} name={author.name} className="w-10 h-10" />
        <div className="flex-1 min-w-0">
          {authorLink ? (
            <Link to={authorLink} className="font-medium hover:underline">{author.name}</Link>
          ) : (
            <h4>{author.name}</h4>
          )}
          <p className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</p>
        </div>
        {user && (user.id === post.authorId || user.role === "admin") && (
          <button
            onClick={() => {
              if (confirm("Xóa bài đăng này?")) {
                deletePost(post.id);
                toast.success("Đã xóa bài đăng");
              }
            }}
            aria-label="Xóa bài đăng"
            className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {post.content && <p className="px-4 pb-4 whitespace-pre-line">{post.content}</p>}
      {post.image && <img src={post.image} alt="Post" className="w-full max-h-[600px] object-cover" />}

      <div className="p-4 border-t border-border flex items-center gap-6">
        <button
          onClick={() => requireLogin() && togglePostLike(post.id)}
          className={`flex items-center gap-2 transition-colors ${liked ? "text-pink-600" : "text-muted-foreground hover:text-primary"}`}
        >
          <Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} />
          <span>{post.likes.length}</span>
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
          <MessageCircle className="w-5 h-5" />
          <span>{post.comments.length}</span>
        </button>
      </div>

      {showComments && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
          {post.comments.map((c) => {
            const p = people[c.authorId] ?? { name: "Người dùng", avatar: "" };
            return (
              <div key={c.id} className="flex gap-2">
                <Avatar src={p.avatar} name={p.name} className="w-8 h-8" />
                <div className="bg-secondary rounded-2xl px-3 py-2 text-sm">
                  <div className="font-medium">{p.name}</div>
                  <div>{c.text}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{timeAgo(c.at)}</div>
                </div>
              </div>
            );
          })}
          <form onSubmit={submitComment} className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={user ? "Viết bình luận..." : "Đăng nhập để bình luận"}
              className="flex-1 px-3 py-2 bg-input-background rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="submit" disabled={!comment.trim()} aria-label="Gửi" className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function PostComposer() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await createPost(content, image);
      setContent("");
      setImage("");
      toast.success("Đã đăng bài");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex gap-3">
        <Avatar src={user.avatar} name={user.fullName} className="w-10 h-10" />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="Bạn đang nghĩ gì? Chia sẻ tác phẩm hoặc cập nhật mới..."
          className="flex-1 px-3 py-2 bg-input-background rounded-lg border border-border resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {image && (
        <div className="relative inline-block">
          <img src={image} alt="Ảnh đính kèm" className="max-h-48 rounded-lg" />
          <button onClick={() => setImage("")} aria-label="Bỏ ảnh" className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex justify-between items-center">
        <ImagePicker onPick={([url]) => setImage(url!)} className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary rounded-lg">
          <ImagePlus className="w-5 h-5" /> Ảnh
        </ImagePicker>
        <button onClick={submit} disabled={busy || (!content.trim() && !image)} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
          {busy && <Spinner className="w-4 h-4" />}
          Đăng
        </button>
      </div>
    </div>
  );
}
