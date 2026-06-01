import { Input } from "@/components/ui/input";

const CODES = [
  { code: "+32", label: "🇧🇪 +32" },
  { code: "+31", label: "🇳🇱 +31" },
  { code: "+33", label: "🇫🇷 +33" },
  { code: "+49", label: "🇩🇪 +49" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+34", label: "🇪🇸 +34" },
  { code: "+39", label: "🇮🇹 +39" },
  { code: "+351", label: "🇵🇹 +351" },
  { code: "+41", label: "🇨🇭 +41" },
  { code: "+43", label: "🇦🇹 +43" },
  { code: "+352", label: "🇱🇺 +352" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+90", label: "🇹🇷 +90" },
  { code: "+212", label: "🇲🇦 +212" },
  { code: "+48", label: "🇵🇱 +48" },
  { code: "+46", label: "🇸🇪 +46" },
  { code: "+47", label: "🇳🇴 +47" },
  { code: "+45", label: "🇩🇰 +45" },
];

const PhoneInput = ({
  countryCode,
  phone,
  onCountryCodeChange,
  onPhoneChange,
}: {
  countryCode: string;
  phone: string;
  onCountryCodeChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
}) => {
  return (
    <div className="flex gap-2">
      <select
        value={countryCode}
        onChange={(e) => onCountryCodeChange(e.target.value)}
        className="h-10 w-28 rounded-md border border-input bg-background px-2 text-sm"
      >
        {CODES.map((c) => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>
      <Input
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        placeholder="Telefoonnummer"
        className="flex-1"
      />
    </div>
  );
};

export default PhoneInput;
