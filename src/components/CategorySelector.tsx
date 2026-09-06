import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

const CategorySelector = ({
  tournamentId,
  isMultiCategory,
  selectedCategoryId,
  onSelect,
  className,
  selectClassName,
}: {
  tournamentId: string;
  isMultiCategory: boolean;
  selectedCategoryId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
  selectClassName?: string;
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const isMobile = useIsMobile();

  const truncateName = (name: string) => {
    if (name.length > 20) return name.slice(0, 17) + "...";
    return name;
  };

  useEffect(() => {
    if (!isMultiCategory) return;

    supabase
      .from("tournament_categories")
      .select("id, name, sort_order")
      .eq("tournament_id", tournamentId)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) {
          console.error("CategorySelector load error:", error);
          return;
        }

        const nextCategories = data || [];
        setCategories(nextCategories);

        if (nextCategories.length === 0) {
          onSelect(null);
          return;
        }

        const hasSelectedCategory = nextCategories.some((category) => category.id === selectedCategoryId);
        if (!selectedCategoryId || !hasSelectedCategory) {
          onSelect(nextCategories[0].id);
        }
      });
  }, [tournamentId, isMultiCategory, selectedCategoryId, onSelect]);

  if (!isMultiCategory || categories.length === 0) return null;

  if (isMobile) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Divisie</span>
        <Select value={selectedCategoryId || ""} onValueChange={(v) => onSelect(v || null)}>
          <SelectTrigger className={cn("h-8 flex-1 min-w-0 text-[11px] font-black uppercase tracking-wider", selectClassName)}>
            <SelectValue placeholder="Kies divisie" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Divisie</span>
      <select
        value={selectedCategoryId || ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className={cn("h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium", selectClassName)}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {truncateName(c.name)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CategorySelector;
