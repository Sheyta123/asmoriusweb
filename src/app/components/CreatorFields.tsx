import { BODY_LABELS, FORMAT_LABELS } from "../lib/pricing";
import type { PriceList } from "../lib/types";

export const STYLE_TAGS = [
  "Dark Fantasy", "Pastel", "Gothic", "Kawaii", "Cyberpunk", "Steampunk", "Horror", "Cute", "Romance",
  "Action", "Sci-Fi", "Mystery", "Fantasy", "Realistic", "Anime", "Chibi", "Semi-Realistic", "Cartoon",
  "Landscape", "Portrait", "Character Design", "Concept Art", "Digital Art", "Traditional", "Full Color",
  "Sketch", "Lineart", "Watercolor", "Oil Painting", "Pixel Art", "Atmospheric", "Short Story", "Worldbuilding", "Plot",
];

const PRICE_FIELDS: { key: keyof PriceList; label: string; group: string }[] = [
  ...(Object.keys(FORMAT_LABELS) as (keyof typeof FORMAT_LABELS)[]).map((k) => ({ key: k, label: FORMAT_LABELS[k], group: "Format" })),
  ...(Object.keys(BODY_LABELS) as (keyof typeof BODY_LABELS)[]).map((k) => ({ key: k, label: BODY_LABELS[k].split(" ")[0]!, group: "Phần vẽ" })),
  { key: "extraCharacter", label: "Thêm nhân vật (mỗi NV)", group: "Yêu cầu khác" },
  { key: "background", label: "Background", group: "Yêu cầu khác" },
];

export function PriceListEditor({ value, onChange }: { value: PriceList; onChange: (v: PriceList) => void }) {
  const groups = [...new Set(PRICE_FIELDS.map((f) => f.group))];
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {groups.map((g) => (
        <div key={g} className="p-4 rounded-lg bg-secondary/60 space-y-3">
          <h4 className="font-semibold">{g}</h4>
          {PRICE_FIELDS.filter((f) => f.group === g).map((f) => (
            <div key={f.key}>
              <label className="block text-sm mb-1 font-normal">{f.label}</label>
              <div className="relative">
                <input
                  inputMode="numeric"
                  value={value[f.key] ? value[f.key].toLocaleString("vi-VN") : ""}
                  onChange={(e) => onChange({ ...value, [f.key]: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                  placeholder="0"
                  className="w-full pl-3 pr-12 py-2 bg-card rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">VND</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TagPicker({ value, onChange, max = 6 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {STYLE_TAGS.map((tag) => {
          const active = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              disabled={!active && value.length >= max}
              onClick={() => onChange(active ? value.filter((t) => t !== tag) : [...value, tag])}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-40 ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Đã chọn {value.length}/{max}</p>
    </div>
  );
}
