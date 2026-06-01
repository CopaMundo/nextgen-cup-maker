import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast({ title: "Wachtwoord gewijzigd", description: "Je kunt nu inloggen met je nieuwe wachtwoord" });
      navigate("/login");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SEOHead title="Nieuw wachtwoord – Copa Mundo" description="Stel een nieuw wachtwoord in voor je Copa Mundo account." noIndex />
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">Nieuw wachtwoord</h1>
          <p className="mt-2 text-muted-foreground">Kies een nieuw wachtwoord voor je account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-8">
          <div className="space-y-2">
            <Label htmlFor="password">Nieuw wachtwoord</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimaal 6 tekens" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Bezig..." : "Wachtwoord wijzigen"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
