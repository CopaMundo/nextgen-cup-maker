import { cn } from "@/lib/utils";
import { countryToFlagUrl } from "@/lib/countryFlags";

interface CountryFlagProps {
  country: string | null | undefined;
  className?: string;
}

/** Renders a country flag as an <img> using Twemoji SVGs – flat style with rounded corners, identical shape for every country */
const CountryFlag = ({ country, className }: CountryFlagProps) => {
  const url = countryToFlagUrl(country);
  if (!url) return null;
  return <img src={url} alt={country || ""} className={cn("country-flag-img h-5 w-6 object-cover inline-block", className)} loading="lazy" />;
};


export default CountryFlag;
