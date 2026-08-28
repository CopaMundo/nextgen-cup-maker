import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
}: {
  tournamentId: string;
  isMultiCategory: boolean;
  selectedCategoryId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}) => {
  const [categories, setCategories] = useState<Category[]>([]);

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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Divisie</span>
      <select
        value={selectedCategoryId || ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CategorySelector;
