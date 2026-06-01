import { Info, Users, Trophy, Calendar, Home } from "lucide-react";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";

interface Props {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  tournament: any;
  favoriteTeam?: string | null;
  teams?: any[];
}

const PublicBottomNav = ({ activeTab, setActiveTab, tournament, favoriteTeam, teams }: Props) => {
  const bStyle = useBroadcastStyle();
  const favTeam = favoriteTeam ? teams?.find((t: any) => t.id === favoriteTeam) : null;

  const tabs: { id: string; label: string; icon: any; isCenter?: boolean }[] = [
    { id: "info", label: "Info", icon: Info },
    { id: "teams", label: "Teams", icon: Users },
    { id: "home", label: "", icon: Home, isCenter: true },
    { id: "standings", label: "Standen", icon: Trophy },
    { id: "schedule", label: "Schema", icon: Calendar },
  ];

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 safe-area-bottom ${ds(bStyle, "navBar")}`}>
      <div className="flex items-end justify-around px-2 pt-1 pb-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          if (tab.isCenter) {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all border-2 ${
                  isActive ? ds(bStyle, "navCenterActive") : ds(bStyle, "navCenter")
                }`}
              >
                {favTeam?.logo_url ? (
                  <img src={favTeam.logo_url} alt="" className="h-8 w-8 object-contain" />
                ) : tournament.logo_url ? (
                  <img src={tournament.logo_url} alt="" className="h-8 w-8 object-contain" />
                ) : (
                  <Icon className="h-6 w-6" />
                )}
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-all ${
                isActive ? ds(bStyle, "navTabActive") : ds(bStyle, "navTab")
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                {isActive && <div className={ds(bStyle, "navIndicator")} />}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "" : "font-medium"}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default PublicBottomNav;
