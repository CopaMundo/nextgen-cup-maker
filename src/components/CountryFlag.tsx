import { cn } from "@/lib/utils";
import { countryToFlagUrl } from "@/lib/countryFlags";

interface CountryFlagProps {
  country: string | null | undefined;
  className?: string;
}

/** Renders a country flag as an <img> using flagcdn.com SVGs – works on all platforms including Windows desktop */
const CountryFlag = ({ country, className }: CountryFlagProps) => {
  const url = countryToFlagUrl(country);
  if (!url) return null;
  return <img src={url} alt={country || ""} className={cn("country-flag-img h-4 w-5 object-contain inline-block", className, "rounded-[3px]")} loading="lazy" />;
};

export default CountryFlag;
