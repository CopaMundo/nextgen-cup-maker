import { ArrowLeft } from "lucide-react";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";

interface PublicBackButtonProps {
  onClick: () => void;
  label?: string;
}

const PublicBackButton = ({ onClick, label = "Terug" }: PublicBackButtonProps) => {
  const bStyle = useBroadcastStyle();
  return (
    <div className="sticky top-0 z-30 -mx-3 px-3 py-2.5 bg-background/95 backdrop-blur-sm border-b border-border/30">
      <button type="button" onClick={onClick} className={ds(bStyle, "backButton")}>
        <ArrowLeft className="h-4 w-4" /> {label}
      </button>
    </div>
  );
};

export default PublicBackButton;
