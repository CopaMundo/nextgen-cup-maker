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

  const selectedName = categories.find((c) => c.id === selectedCategoryId)?.name || "";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground", !isMobile && "w-12")}>Divisie</span>
      <Select value={selectedCategoryId || ""} onValueChange={(value) => onSelect(value || null)}>
        <SelectTrigger
          title={selectedName}
          className={cn("h-8 w-auto min-w-fit max-w-[20ch] gap-2 px-2 text-xs font-medium", !isMobile && "h-7", selectClassName)}
        >
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
};

export default CategorySelector;
