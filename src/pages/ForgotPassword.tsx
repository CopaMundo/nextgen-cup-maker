import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";
import SEOHead from "@/components/SEOHead";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="rounded-xl border border-border bg-card p-8">
            <Mail className="mx-auto h-12 w-12 text-primary mb-4" />
            <h2 className="font-display text-2xl font-bold text-foreground">E-mail verstuurd</h2>
            <p className="mt-3 text-muted-foreground">Controleer je inbox voor de reset-link.</p>
          </div>
          <Link to="/login" className="text-sm text-primary hover:underline">Terug naar inloggen</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SEOHead title="Wachtwoord vergeten – Copa Mundo" description="Herstel je Copa Mundo wachtwoord via e-mail." canonical="/forgot-password" noIndex />
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">Wachtwoord vergeten</h1>
          <p className="mt-2 text-muted-foreground">Vul je e-mailadres in om een reset-link te ontvangen</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-8">
          <div className="space-y-2">
            <Label htmlFor="email">E-mailadres</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jouw@email.com" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Bezig..." : "Reset-link versturen"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Terug naar inloggen</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
