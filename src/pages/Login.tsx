import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Eye, EyeOff } from "lucide-react";
import copaLogo from "@/assets/copa-mundo-full-logo.png";
import SEOHead from "@/components/SEOHead";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Inloggen mislukt", description: error.message, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SEOHead title="Inloggen – Copa Mundo" description="Log in op je Copa Mundo account om je toernooien te beheren." canonical="/login" noIndex />
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <img src={copaLogo} alt="Copa Mundo" className="h-12 w-auto object-contain" />
            <span className="font-display text-xl font-bold text-foreground">COPA MUNDO</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-foreground">Welkom terug</h1>
          <p className="mt-2 text-muted-foreground">Log in op je account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 rounded-xl border border-border bg-card p-8">
          <div className="space-y-2">
            <Label htmlFor="email">E-mailadres</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jouw@email.com" required className="border-border focus:border-primary focus:ring-primary" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Wachtwoord</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors">Wachtwoord vergeten?</Link>
            </div>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="border-border focus:border-primary focus:ring-primary" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Bezig..." : <><LogIn className="h-4 w-4" /> Inloggen</>}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Nog geen account? <Link to="/register" className="text-primary hover:text-primary/80 font-medium">Registreer hier</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
