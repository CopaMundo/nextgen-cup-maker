import type { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Standaard sensors voor sleeplijsten (kleine drempel zodat kliks blijven werken). */
export const useDndSensors = () =>
  useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

/** Verticale sleeplijst: geeft de nieuwe volgorde terug bij het neerzetten. */
export function SortableVerticalList<T>({
  items,
  getId,
  onReorder,
  className,
  children,
}: {
  items: T[];
  getId: (item: T) => string;
  onReorder: (next: T[], oldIndex: number, newIndex: number) => void;
  className?: string;
  children: ReactNode;
}) {
  const sensors = useDndSensors();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => getId(i) === String(active.id));
    const newIndex = items.findIndex((i) => getId(i) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex), oldIndex, newIndex);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  );
}

/** Rij binnen een sleeplijst; geeft de sleepgreep door aan de inhoud. */
export const SortableRowShell = ({
  id,
  className,
  dragLabel = "Verplaatsen",
  handleClassName,
  children,
}: {
  id: string;
  className?: string;
  dragLabel?: string;
  handleClassName?: string;
  children: (handle: ReactNode) => ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={dragLabel}
      className={cn(
        "shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none",
        handleClassName,
      )}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(className, isDragging && "opacity-70 shadow-lg z-10 relative")}
    >
      {children(handle)}
    </div>
  );
};
