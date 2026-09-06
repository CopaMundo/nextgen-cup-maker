import markUrl from "@/assets/copa-mundo-mark.png";

interface Props {
  className?: string;
  title?: string;
}

/**
 * Copa Mundo beeldmerk. Wordt als masker getekend zodat het logo
 * automatisch de themakleur (primary) aanneemt:
 * geel in donkere modus, blauw in lichte modus.
 */
const CopaMundoMark = ({ className = "h-10 w-10", title = "Copa Mundo" }: Props) => (
  <span
    role="img"
    aria-label={title}
    className={`inline-block bg-primary ${className}`}
    style={{
      WebkitMaskImage: `url(${markUrl})`,
      maskImage: `url(${markUrl})`,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      WebkitMaskSize: "contain",
      maskSize: "contain",
    }}
  />
);

export default CopaMundoMark;
