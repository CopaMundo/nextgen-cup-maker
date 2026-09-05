import { LogIn, User, LogOut, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ChampionsTrophyIcon from "@/components/icons/ChampionsTrophyIcon";
import trophyLogo from "@/assets/copa-mundo-trophy.png";

const Navbar = () => {
  const { user, signOut } = useAuth();

  return (
    <nav className="border-b border-border px-4 sm:px-6 py-2">
      <div className="flex items-center justify-between w-full">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2.5">
          <img src={trophyLogo} alt="Copa Mundo" className="h-9 w-9 sm:h-10 sm:w-10 object-contain" />
          <span className="font-display text-lg sm:text-xl font-black tracking-tight text-primary uppercase">
            Copa Mundo
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-2.5"
              >
                <ChampionsTrophyIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mijn Toernooien</span>
              </Link>
              <Link
                to="/profile"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Profiel</span>
              </Link>
              <button
                onClick={signOut}
                className="flex items-center gap-2 rounded-lg border border-primary/20 px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-lg border border-primary/20 px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Login</span>
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-2 rounded-lg bg-primary px-3 sm:px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Registreer</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
