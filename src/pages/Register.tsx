import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import CopaMundoMark from "@/components/CopaMundoMark";
import SEOHead from "@/components/SEOHead";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Wachtwoord te kort", description: "Minimaal 6 tekens", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Registratie mislukt", description: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Controleer je e-mail</h2>
            <p className="mt-3 text-muted-foreground">We hebben een verificatielink gestuurd naar <strong className="text-primary">{email}</strong>. Klik op de link om je account te activeren.</p>
          </div>
          <Link to="/login" className="text-sm text-primary hover:text-primary/80">Terug naar inloggen</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SEOHead title="Registreren – Copa Mundo" description="Maak een gratis Copa Mundo account aan en start met het organiseren van toernooien." canonical="/register" noIndex />
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <CopaMundoMark className="h-12 w-12" />
            <span className="font-display text-xl font-bold text-foreground">COPA MUNDO</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-foreground">Account aanmaken</h1>
          <p className="mt-2 text-muted-foreground">Start met het beheren van je toernooien</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5 rounded-xl border border-border bg-card p-8">
          <div className="space-y-2">
            <Label htmlFor="name">Naam</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Je naam" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mailadres</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jouw@email.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Wachtwoord</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimaal 6 tekens" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Bezig..." : <><UserPlus className="h-4 w-4" /> Registreren</>}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Al een account? <Link to="/login" className="text-primary hover:text-primary/80 font-medium">Log hier in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
