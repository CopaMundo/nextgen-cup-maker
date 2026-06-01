import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { User, Upload, Save } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { compressImage, getFileExtension } from "@/lib/compressImage";
import CountrySelect from "@/components/CountrySelect";
import PhoneInput from "@/components/PhoneInput";

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    organization: "",
    phone: "",
    phone_country_code: "+32",
    country: "",
    city: "",
    address: "",
    postal_code: "",
    avatar_url: "",
  });

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .single();
    if (data) {
      setProfile({
        first_name: (data as any).first_name || "",
        last_name: (data as any).last_name || "",
        display_name: data.display_name || "",
        organization: data.organization || "",
        phone: data.phone || "",
        phone_country_code: (data as any).phone_country_code || "+32",
        country: data.country || "",
        city: (data as any).city || "",
        address: (data as any).address || "",
        postal_code: (data as any).postal_code || "",
        avatar_url: data.avatar_url || "",
      });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setUploading(true);
    const file = await compressImage(rawFile);
    const ext = getFileExtension(file);
    const path = `${user!.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload mislukt", description: uploadError.message, variant: "destructive" });
    } else {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setProfile((p) => ({ ...p, avatar_url: publicUrl }));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!profile.last_name.trim()) {
      toast({ title: "Naam is verplicht", variant: "destructive" });
      return;
    }
    if (!profile.first_name.trim()) {
      toast({ title: "Voornaam is verplicht", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: `${profile.first_name} ${profile.last_name}`.trim(),
        organization: profile.organization,
        phone: profile.phone,
        country: profile.country,
        avatar_url: profile.avatar_url,
        first_name: profile.first_name,
        last_name: profile.last_name,
        city: profile.city,
        address: profile.address,
        postal_code: profile.postal_code,
        phone_country_code: profile.phone_country_code,
      } as any)
      .eq("user_id", user!.id);
    setLoading(false);
    if (error) {
      toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profiel bijgewerkt" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Profiel – Copa Mundo" description="Beheer je Copa Mundo profiel en accountinstellingen." noIndex />
      <Navbar />
      <div className="container mx-auto max-w-2xl px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-8">Profiel</h1>

        <div className="space-y-6 rounded-xl border border-border bg-card p-8">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-secondary">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><User className="h-8 w-8 text-muted-foreground" /></div>
              )}
            </div>
            <div>
              <Label htmlFor="avatar" className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:border-white/30 transition-colors">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploaden..." : "Foto wijzigen"}
              </Label>
              <input id="avatar" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Naam *</Label>
              <Input value={profile.last_name} onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))} placeholder="Achternaam" />
            </div>
            <div className="space-y-2">
              <Label>Voornaam *</Label>
              <Input value={profile.first_name} onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))} placeholder="Voornaam" />
            </div>
            <div className="space-y-2">
              <Label>Organisatie / Club</Label>
              <Input value={profile.organization} onChange={(e) => setProfile((p) => ({ ...p, organization: e.target.value }))} placeholder="Optioneel" />
            </div>
            <div className="space-y-2">
              <Label>Land</Label>
              <CountrySelect value={profile.country} onChange={(v) => setProfile((p) => ({ ...p, country: v }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Telefoon</Label>
              <PhoneInput
                countryCode={profile.phone_country_code}
                phone={profile.phone}
                onCountryCodeChange={(v) => setProfile((p) => ({ ...p, phone_country_code: v }))}
                onPhoneChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Woonplaats</Label>
              <Input value={profile.city} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} placeholder="Optioneel" />
            </div>
            <div className="space-y-2">
              <Label>Postcode</Label>
              <Input value={profile.postal_code} onChange={(e) => setProfile((p) => ({ ...p, postal_code: e.target.value }))} placeholder="Optioneel" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Adres</Label>
              <Input value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} placeholder="Optioneel" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4" />
              {loading ? "Opslaan..." : "Opslaan"}
            </Button>
          </div>
        </div>

        {/* Change password */}
        <div className="mt-8 rounded-xl border border-border bg-card p-8">
          <h2 className="font-display text-xl font-bold text-foreground mb-4">Wachtwoord wijzigen</h2>
          <ChangePassword />
        </div>
      </div>
    </div>
  );
};

const ChangePassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleChange = async () => {
    if (password.length < 6) {
      toast({ title: "Te kort", description: "Minimaal 6 tekens", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Wachtwoord gewijzigd" });
      setPassword("");
    }
  };

  return (
    <div className="flex gap-3">
      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nieuw wachtwoord" className="max-w-xs" />
      <Button variant="outline" onClick={handleChange} disabled={loading}>
        {loading ? "Bezig..." : "Wijzigen"}
      </Button>
    </div>
  );
};

export default Profile;
