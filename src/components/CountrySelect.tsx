import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COUNTRIES = [
  "Afghanistan","Albanië","Algerije","Andorra","Angola","Argentinië","Armenië","Australië","Azerbeidzjan",
  "Bahama's","Bahrein","Bangladesh","Barbados","België","Belize","Benin","Bhutan","Bolivia","Bosnië en Herzegovina",
  "Botswana","Brazilië","Brunei","Bulgarije","Burkina Faso","Burundi","Cambodja","Cameroen","Canada","Chili",
  "China","Colombia","Comoren","Congo","Costa Rica","Kroatië","Cuba","Cyprus","Denemarken","Djibouti",
  "Dominica","Dominicaanse Republiek","Duitsland","Ecuador","Egypte","El Salvador","Engeland","Equatoriaal-Guinea",
  "Eritrea","Estland","Eswatini","Ethiopië","Fiji","Filipijnen","Finland","Frankrijk","Gabon","Gambia",
  "Georgië","Ghana","Griekenland","Grenada","Guatemala","Guinee","Guinee-Bissau","Guyana","Haïti","Honduras",
  "Hongarije","Ierland","IJsland","India","Indonesië","Irak","Iran","Israël","Italië","Ivoorkust","Jamaica",
  "Japan","Jemen","Jordanië","Kaapverdië","Kameroen","Kazachstan","Kenia","Kirgizië","Kiribati","Koeweit",
  "Laos","Lesotho","Letland","Libanon","Liberia","Libië","Liechtenstein","Litouwen","Luxemburg",
  "Madagaskar","Malawi","Maleisië","Maldiven","Mali","Malta","Marokko","Mauritanië","Mauritius","Mexico",
  "Moldavië","Monaco","Mongolië","Montenegro","Mozambique","Myanmar","Namibië","Nauru","Nederland",
  "Nepal","Nicaragua","Nieuw-Zeeland","Niger","Nigeria","Noord-Korea","Noord-Macedonië","Noorwegen",
  "Noord-Ierland",
  "Oeganda","Oekraïne","Oezbekistan","Oman","Oostenrijk","Oost-Timor","Pakistan","Palau","Panama",
  "Papoea-Nieuw-Guinea","Paraguay","Peru","Polen","Portugal","Qatar","Roemenië","Rusland","Rwanda",
  "Saint Kitts en Nevis","Saint Lucia","Saint Vincent en de Grenadines","Salomonseilanden","Samoa",
  "San Marino","Sao Tomé en Principe","Saoedi-Arabië","Schotland","Senegal","Servië","Seychellen","Sierra Leone",
  "Singapore","Slovenië","Slowakije","Soedan","Somalië","Spanje","Sri Lanka","Suriname","Syrië",
  "Tadzjikistan","Tanzania","Thailand","Togo","Tonga","Trinidad en Tobago","Tsjaad","Tsjechië","Tunesië",
  "Turkije","Turkmenistan","Tuvalu","Uruguay","Vanuatu","Vaticaanstad","Venezuela","Verenigde Arabische Emiraten",
  "Verenigde Staten","Verenigd Koninkrijk","Vietnam","Wales","Zambia","Zimbabwe","Zuid-Afrika","Zuid-Korea","Zuid-Soedan","Zweden","Zwitserland"
];

const CountrySelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-full text-sm">
        <SelectValue placeholder="Selecteer land" />
      </SelectTrigger>
      <SelectContent>
        {COUNTRIES.map((country) => (
          <SelectItem key={country} value={country} className="pl-2 [&>span:first-child]:hidden">
            {country}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CountrySelect;
