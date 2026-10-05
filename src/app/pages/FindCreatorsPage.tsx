import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router";
import { Search, Filter, Star, Trophy, Medal, Award, X, SearchX } from "lucide-react";
import { useDb } from "../lib/db";
import { PRICE_TIERS, type PriceTier, priceTierOf, startingPrice, formatVND } from "../lib/pricing";
import { EmptyState } from "../components/common";

const SORTS = [
  { value: "rating", label: "Đánh giá cao nhất" },
  { value: "popular", label: "Nhiều commission nhất" },
  { value: "price_asc", label: "Giá thấp → cao" },
  { value: "price_desc", label: "Giá cao → thấp" },
  { value: "newest", label: "Mới tham gia" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

export function FindCreatorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [selectedType, setSelectedType] = useState<"all" | "Artist" | "Writer">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>(() => searchParams.getAll("tag"));
  const [priceTier, setPriceTier] = useState<PriceTier>("all");
  const [sort, setSort] = useState<SortValue>("rating");
  const [openOnly, setOpenOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(selectedTags.length > 0);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const creators = useDb((db) => db.creators);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    creators.forEach((c) => c.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [creators]);

  useEffect(() => {
    const typeParam = searchParams.get("type");
    if (typeParam === "Artist" || typeParam === "Writer") setSelectedType(typeParam);
    const tags = searchParams.getAll("tag");
    if (tags.length) {
      setSelectedTags(tags);
      setShowFilters(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) setShowTagSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
    setSelectedTags(next);
    const params = new URLSearchParams(searchParams);
    params.delete("tag");
    next.forEach((t) => params.append("tag", t));
    setSearchParams(params, { replace: true });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTags([]);
    setPriceTier("all");
    setSelectedType("all");
    setOpenOnly(false);
    setSearchParams({}, { replace: true });
  };

  const filteredCreators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = creators.filter((creator) => {
      const matchesSearch =
        !q ||
        creator.name.toLowerCase().includes(q) ||
        creator.specialty.toLowerCase().includes(q) ||
        creator.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesType = selectedType === "all" || creator.type === selectedType;
      const matchesTags = selectedTags.every((t) => creator.tags.includes(t));
      const matchesPrice = priceTier === "all" || priceTierOf(creator.priceList) === priceTier;
      return matchesSearch && matchesType && matchesTags && matchesPrice && (!openOnly || creator.isOpen);
    });
    const sorters: Record<SortValue, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      rating: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount,
      popular: (a, b) => b.commissions - a.commissions,
      price_asc: (a, b) => startingPrice(a.priceList) - startingPrice(b.priceList),
      price_desc: (a, b) => startingPrice(b.priceList) - startingPrice(a.priceList),
      newest: (a, b) => b.createdAt - a.createdAt,
    };
    return [...list].sort(sorters[sort]);
  }, [creators, searchQuery, selectedType, selectedTags, priceTier, openOnly, sort]);

  const topCreators = useMemo(() => [...creators].sort((a, b) => b.rating - a.rating || b.commissions - a.commissions).slice(0, 3), [creators]);

  const activeFilterCount = selectedTags.length + (priceTier !== "all" ? 1 : 0) + (openOnly ? 1 : 0);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-2">Tìm Creators</h1>
        <p className="text-muted-foreground">Khám phá và kết nối với các artists & writers tài năng</p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="relative" ref={searchBoxRef}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, kỹ năng, hoặc tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowTagSuggestions(true)}
            className="w-full pl-12 pr-10 py-4 bg-card rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} aria-label="Xóa tìm kiếm" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}

          {showTagSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl border border-border shadow-lg max-h-64 overflow-y-auto z-20">
              <div className="p-4">
                <p className="text-sm text-muted-foreground mb-3">Tags phổ biến — bấm để lọc</p>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        toggleTag(tag);
                        setShowTagSuggestions(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedTags.includes(tag) ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-primary hover:text-primary-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
          {(["all", "Artist", "Writer"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-4 sm:px-6 py-2 rounded-lg transition-colors ${
                selectedType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {t === "all" ? "Tất cả" : `${t}s`}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortValue)}
            aria-label="Sắp xếp"
            className="sm:ml-auto px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 sm:px-6 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Bộ lọc nâng cao
            {activeFilterCount > 0 && <span className="px-1.5 rounded-full bg-primary text-primary-foreground text-xs">{activeFilterCount}</span>}
          </button>
        </div>

        {showFilters && (
          <div className="p-6 bg-card rounded-xl border border-border space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2">Mức giá khởi điểm</label>
                <select
                  value={priceTier}
                  onChange={(e) => setPriceTier(e.target.value as PriceTier)}
                  className="w-full px-4 py-2 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {PRICE_TIERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer sm:mt-8">
                <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="w-4 h-4 accent-primary" />
                <span>Chỉ hiển thị creator đang mở nhận đơn</span>
              </label>
            </div>
            <div>
              <label className="block mb-2">Tag phân loại (style vẽ, thể loại, độ phủ màu...)</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedTags.includes(tag) ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-sm text-primary hover:underline">
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mb-12">
        <div className="bg-gradient-to-br from-primary/5 to-purple-100/50 rounded-2xl border border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="w-6 h-6 text-primary" />
            <h2>Monthly Favorite Creators</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topCreators.map((artist, index) => (
              <Link key={artist.id} to={`/creator/${artist.id}`}>
                <div className="flex items-center gap-4 bg-card rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex-shrink-0">{getRankIcon(index)}</div>
                  <img src={artist.image} alt={artist.name} className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <h4 className="truncate">{artist.name}</h4>
                    <p className="text-sm text-muted-foreground truncate">{artist.specialty}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{artist.rating.toFixed(1)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-end justify-between gap-4">
        <h2>Tất cả Creators</h2>
        <p className="text-muted-foreground text-sm">
          Tìm thấy <span className="font-semibold text-foreground">{filteredCreators.length}</span> creators
        </p>
      </div>

      {filteredCreators.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Không tìm thấy creator phù hợp"
          description="Thử bỏ bớt tag hoặc mở rộng mức giá."
          action={<button onClick={clearFilters} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg">Xóa bộ lọc</button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCreators.map((creator) => (
            <Link key={creator.id} to={`/creator/${creator.id}`} className="block">
              <div className="h-full bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group flex flex-col">
                <div className="relative h-48 overflow-hidden">
                  <img src={creator.image} alt={creator.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  <div className="absolute top-3 right-3 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm">{creator.type}</div>
                  {!creator.isOpen && <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 text-white rounded-full text-xs">Tạm đóng đơn</div>}
                </div>
                <div className="p-5 space-y-3 flex-1 flex flex-col">
                  <div>
                    <h3 className="mb-1">{creator.name}</h3>
                    <p className="text-sm text-muted-foreground">{creator.specialty}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{creator.ratingCount > 0 ? creator.rating.toFixed(1) : "Mới"}</span>
                    </div>
                    <div className="text-muted-foreground">{creator.commissions} commissions</div>
                  </div>
                  <div className="text-primary text-sm">
                    Từ <span className="font-semibold">{formatVND(startingPrice(creator.priceList))}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {creator.tags.map((tag) => (
                      <span key={tag} className={`px-2 py-1 rounded text-xs ${selectedTags.includes(tag) ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto pt-2">
                    <span className="block w-full py-2 text-center bg-primary text-primary-foreground rounded-lg group-hover:bg-primary/90 transition-colors">Xem hồ sơ</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
