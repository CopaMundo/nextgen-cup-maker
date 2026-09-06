import blueLogo from "@/assets/copa-mundo-blue.png.asset.json";
import yellowLogo from "@/assets/copa-mundo-yellow.png.asset.json";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  className?: string;
  title?: string;
}

const CopaMundoMark = ({ className = "h-10 w-10", title = "Copa Mundo" }: Props) => {
  const { mode } = useTheme();

  return (
    <img
      src={mode === "dark" ? yellowLogo.url : blueLogo.url}
      alt={title}
      className={`inline-block object-contain ${className}`}
    />
  );
};

export default CopaMundoMark;
