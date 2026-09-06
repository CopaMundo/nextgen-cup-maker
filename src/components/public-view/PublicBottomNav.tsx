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
    <nav className={`fixed inset-x-0 bottom-0 z-50 safe-area-bottom ${ds(bStyle, "navBar")}`}>


      <div className="relative grid h-16 grid-cols-5 items-end px-2 pt-1 pb-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          if (tab.isCenter) {
            const logoSrc = favTeam?.logo_url || tournament.logo_url;
            const isWc26 = bStyle === "wc26";

            return (
              <div key={tab.id} className="h-12 w-full">
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`absolute left-1/2 ${isWc26 ? "bottom-2" : "top-1 -translate-y-3"} -translate-x-1/2 transform-gpu items-center justify-center shadow-lg transition-colors ${
                    isWc26
                      ? `wc26-home-btn flex h-[72px] w-12 rounded-[6px] border-2 bg-card ${
                          isActive ? "border-primary" : "border-[hsl(var(--broadcast-gold))]"
                        }`
                      : `flex h-14 w-14 rounded-2xl border-2 ${
                          isActive ? ds(bStyle, "navCenterActive") : ds(bStyle, "navCenter")
                        }`
                  }`}
                >
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt=""
                      width={isWc26 ? 36 : 32}
                      height={isWc26 ? 36 : 32}
                      className={`object-contain ${isWc26 ? "h-9 w-9" : "h-8 w-8"}`}
                    />
                  ) : (
                    <Icon className={`${isWc26 ? "h-7 w-7 text-foreground" : "h-6 w-6"}`} />
                  )}
                </button>
              </div>
            );
          }



          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex h-12 w-full flex-col items-center justify-end gap-0.5 py-1 transition-colors ${
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
