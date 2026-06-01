// Special subdivision flags (England, Scotland, Wales, Northern Ireland)
const SUBDIVISION_FLAGS: Record<string, string> = {
  "Engeland": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Schotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Noord-Ierland": "🇬🇧",
  // English versions
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Northern Ireland": "🇬🇧",
};

// Subdivision ISO codes for SVG flags
const SUBDIVISION_ISO: Record<string, string> = {
  "Engeland": "gb-eng",
  "Schotland": "gb-sct",
  "Wales": "gb-wls",
  "Noord-Ierland": "gb-nir",
  "England": "gb-eng",
  "Scotland": "gb-sct",
  "Northern Ireland": "gb-nir",
};

const COUNTRY_TO_ISO: Record<string, string> = {
  "Afghanistan": "AF", "Albanië": "AL", "Algerije": "DZ", "Andorra": "AD", "Angola": "AO",
  "Argentinië": "AR", "Armenië": "AM", "Australië": "AU", "Azerbeidzjan": "AZ",
  "Bahama's": "BS", "Bahrein": "BH", "Bangladesh": "BD", "Barbados": "BB", "België": "BE",
  "Belize": "BZ", "Benin": "BJ", "Bhutan": "BT", "Bolivia": "BO", "Bosnië en Herzegovina": "BA",
  "Botswana": "BW", "Brazilië": "BR", "Brunei": "BN", "Bulgarije": "BG", "Burkina Faso": "BF",
  "Burundi": "BI", "Cambodja": "KH", "Cameroen": "CM", "Canada": "CA", "Chili": "CL",
  "China": "CN", "Colombia": "CO", "Comoren": "KM", "Congo": "CG", "Costa Rica": "CR",
  "Kroatië": "HR", "Cuba": "CU", "Cyprus": "CY", "Denemarken": "DK", "Djibouti": "DJ",
  "Dominica": "DM", "Dominicaanse Republiek": "DO", "Duitsland": "DE", "Ecuador": "EC",
  "Egypte": "EG", "El Salvador": "SV", "Equatoriaal-Guinea": "GQ", "Eritrea": "ER",
  "Estland": "EE", "Eswatini": "SZ", "Ethiopië": "ET", "Fiji": "FJ", "Filipijnen": "PH",
  "Finland": "FI", "Frankrijk": "FR", "Gabon": "GA", "Gambia": "GM", "Georgië": "GE",
  "Ghana": "GH", "Griekenland": "GR", "Grenada": "GD", "Guatemala": "GT", "Guinee": "GN",
  "Guinee-Bissau": "GW", "Guyana": "GY", "Haïti": "HT", "Honduras": "HN", "Hongarije": "HU",
  "Ierland": "IE", "IJsland": "IS", "India": "IN", "Indonesië": "ID", "Irak": "IQ",
  "Iran": "IR", "Israël": "IL", "Italië": "IT", "Ivoorkust": "CI", "Jamaica": "JM",
  "Japan": "JP", "Jemen": "YE", "Jordanië": "JO", "Kaapverdië": "CV", "Kameroen": "CM",
  "Kazachstan": "KZ", "Kenia": "KE", "Kirgizië": "KG", "Kiribati": "KI", "Koeweit": "KW",
  "Laos": "LA", "Lesotho": "LS", "Letland": "LV", "Libanon": "LB", "Liberia": "LR",
  "Libië": "LY", "Liechtenstein": "LI", "Litouwen": "LT", "Luxemburg": "LU",
  "Madagaskar": "MG", "Malawi": "MW", "Maleisië": "MY", "Maldiven": "MV", "Mali": "ML",
  "Malta": "MT", "Marokko": "MA", "Mauritanië": "MR", "Mauritius": "MU", "Mexico": "MX",
  "Moldavië": "MD", "Monaco": "MC", "Mongolië": "MN", "Montenegro": "ME", "Mozambique": "MZ",
  "Myanmar": "MM", "Namibië": "NA", "Nauru": "NR", "Nederland": "NL", "Nepal": "NP",
  "Nicaragua": "NI", "Nieuw-Zeeland": "NZ", "Niger": "NE", "Nigeria": "NG",
  "Noord-Korea": "KP", "Noord-Macedonië": "MK", "Noorwegen": "NO", "Oeganda": "UG",
  "Oekraïne": "UA", "Oezbekistan": "UZ", "Oman": "OM", "Oostenrijk": "AT", "Oost-Timor": "TL",
  "Pakistan": "PK", "Palau": "PW", "Panama": "PA", "Papoea-Nieuw-Guinea": "PG",
  "Paraguay": "PY", "Peru": "PE", "Polen": "PL", "Portugal": "PT", "Qatar": "QA",
  "Roemenië": "RO", "Rusland": "RU", "Rwanda": "RW", "Saint Kitts en Nevis": "KN",
  "Saint Lucia": "LC", "Saint Vincent en de Grenadines": "VC", "Salomonseilanden": "SB",
  "Samoa": "WS", "San Marino": "SM", "Sao Tomé en Principe": "ST", "Saoedi-Arabië": "SA",
  "Senegal": "SN", "Servië": "RS", "Seychellen": "SC", "Sierra Leone": "SL",
  "Singapore": "SG", "Slovenië": "SI", "Slowakije": "SK", "Soedan": "SD", "Somalië": "SO",
  "Spanje": "ES", "Sri Lanka": "LK", "Suriname": "SR", "Syrië": "SY", "Tadzjikistan": "TJ",
  "Tanzania": "TZ", "Thailand": "TH", "Togo": "TG", "Tonga": "TO",
  "Trinidad en Tobago": "TT", "Tsjaad": "TD", "Tsjechië": "CZ", "Tunesië": "TN",
  "Turkije": "TR", "Turkmenistan": "TM", "Tuvalu": "TV", "Uruguay": "UY", "Vanuatu": "VU",
  "Vaticaanstad": "VA", "Venezuela": "VE", "Verenigde Arabische Emiraten": "AE",
  "Verenigde Staten": "US", "Verenigd Koninkrijk": "GB", "Vietnam": "VN", "Zambia": "ZM",
  "Zimbabwe": "ZW", "Zuid-Afrika": "ZA", "Zuid-Korea": "KR", "Zuid-Soedan": "SS",
  "Zweden": "SE", "Zwitserland": "CH",
};

/** Legacy emoji flag function – kept for backward compat but prefer countryToFlagUrl */
export const countryToFlag = (country: string | null | undefined): string => {
  if (!country) return "";
  if (SUBDIVISION_FLAGS[country]) return SUBDIVISION_FLAGS[country];
  const iso = COUNTRY_TO_ISO[country] || country;
  if (iso.length === 2) {
    return String.fromCodePoint(
      ...([...iso.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
    );
  }
  return "";
};

/** Returns a flagcdn.com SVG URL for the given country name or ISO code */
export const countryToFlagUrl = (country: string | null | undefined): string | null => {
  if (!country) return null;
  // Check subdivision first
  if (SUBDIVISION_ISO[country]) {
    return `https://flagcdn.com/w40/${SUBDIVISION_ISO[country]}.png`;
  }
  const iso = COUNTRY_TO_ISO[country] || country;
  if (iso.length === 2) {
    return `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;
  }
  return null;
};
