import blueLogo from "@/assets/copa-mundo-blue.png.asset.json";
import yellowLogo from "@/assets/copa-mundo-yellow.png.asset.json";

interface Props {
  className?: string;
  title?: string;
}

const CopaMundoMark = ({ className = "h-10 w-10", title = "Copa Mundo" }: Props) => (
  <span className={`inline-block ${className}`}>
    <img
      src={yellowLogo.url}
      alt={title}
      className="hidden h-full w-full object-contain [[data-mode=dark]_&]:block"
    />
    <img
      src={blueLogo.url}
      alt={title}
      className="h-full w-full object-contain [[data-mode=dark]_&]:hidden"
    />
  </span>
);

export default CopaMundoMark;
