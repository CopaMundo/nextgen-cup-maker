const COUNTRIES = [
  "Afghanistan","Albanië","Algerije","Andorra","Angola","Argentinië","Armenië","Australië","Azerbeidzjan",
  "Bahama's","Bahrein","Bangladesh","Barbados","België","Belize","Benin","Bhutan","Bolivia","Bosnië en Herzegovina",
  "Botswana","Brazilië","Brunei","Bulgarije","Burkina Faso","Burundi","Cambodja","Cameroen","Canada","Chili",
  "China","Colombia","Comoren","Congo","Costa Rica","Kroatië","Cuba","Cyprus","Denemarken","Djibouti",
  "Engeland",
  "Dominica","Dominicaanse Republiek","Duitsland","Ecuador","Egypte","El Salvador","Equatoriaal-Guinea",
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

const SORTED_COUNTRIES = [...COUNTRIES].sort((a, b) => a.localeCompare(b, "nl"));

const CountrySelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <option value="">Selecteer land</option>
      {SORTED_COUNTRIES.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
};

export default CountrySelect;
