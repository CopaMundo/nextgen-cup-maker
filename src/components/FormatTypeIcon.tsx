import singleMatchIconAsset from "@/assets/pvp.png.asset.json";
import bracketIconPng from "@/assets/tournament.png";
import listIconPng from "@/assets/list_1.png";

const IconImage = ({ src, className }: { src: string; className?: string }) => (
  <span
    className={`inline-block bg-current text-primary ${className ?? ""}`}
    style={{
      WebkitMaskImage: `url(${src})`,
      maskImage: `url(${src})`,
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
    }}
  />
);

export const formatTypeIcon = (phaseType: string, className = "h-4 w-4") => {
  if (phaseType === "knockout") return <IconImage src={bracketIconPng} className={className} />;
  if (phaseType === "single_match") return <IconImage src={singleMatchIconAsset.url} className={className} />;
  return <IconImage src={listIconPng} className={className} />;
};

export default formatTypeIcon;
