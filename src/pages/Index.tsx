import { Navigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeatureCards from "@/components/FeatureCards";
import SEOHead from "@/components/SEOHead";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Copa Mundo – Toernooi Management Platform"
        description="Organiseer en beheer voetbaltoernooien met Copa Mundo. Maak poules, plan wedstrijden en volg live standen."
        canonical="/"
      />
      <Navbar />
      <HeroSection />
      <FeatureCards />
    </div>
  );
};

export default Index;
