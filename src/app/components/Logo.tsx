import { Link } from "react-router";
import { cn } from "./ui/utils";

export function Logo({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const big = size === "lg";
  return (
    <Link to="/" className={cn("flex items-center gap-2 flex-shrink-0", className)}>
      <div className={cn("rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center", big ? "w-12 h-12" : "w-10 h-10")}>
        <span className={cn("font-bold text-white", big ? "text-2xl" : "text-xl")}>A</span>
      </div>
      <span className={cn("font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent", big ? "text-3xl" : "text-xl")}>Asmorius</span>
    </Link>
  );
}
