import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  MdSportsTennis,
  MdSportsSoccer,
  MdSportsVolleyball,
  MdSportsBasketball,
  MdSportsHandball,
  MdSportsHockey,
  MdSportsCricket,
  MdSportsGolf,
  MdSportsEsports,
  MdSportsKabaddi,
  MdSportsRugby,
  MdSports,
  MdPool,
  MdDirectionsRun,
} from "react-icons/md";
import {
  GiBowlingPin,
  GiDart,
  GiCurlingStone,
  GiHockey,
  GiPingPongBat,
  GiWaterPolo,
  GiPoolTriangle,
} from "react-icons/gi";
import { FaBaseball } from "react-icons/fa6";
import { LuCircleDot } from "react-icons/lu";
import petanqueIcon from "@/assets/petanque-icon.png";
import badmintonIcon from "@/assets/badminton-icon.png";
import footballIcon from "@/assets/football-icon.png";
import athleticsIcon from "@/assets/athletics-icon.png";
import basketballIcon from "@/assets/basketball-icon.png";
import beachtennisIcon from "@/assets/beachtennis-icon.png";
import soccerIcon from "@/assets/soccer-icon.png";
import billiardsIcon from "@/assets/billiards-icon.png";
import bowlingIcon from "@/assets/bowling-icon.png";
import cricketIcon from "@/assets/cricket-icon.png";
import curlingIcon from "@/assets/curling-icon.png";
import wrestlingIcon from "@/assets/wrestling-icon.png";
import dartsIcon from "@/assets/darts-icon.png";
import floorballIcon from "@/assets/floorball-icon.png";
import golfIcon from "@/assets/golf-icon.png";
import baseballIcon from "@/assets/baseball-icon.png";
import handballIcon from "@/assets/handball-icon.png";
import hockeyIcon from "@/assets/hockey-icon.png";
import icehockeyIcon from "@/assets/icehockey-icon.png";
import korfbalIcon from "@/assets/korfbal-icon.png";
import netballIcon from "@/assets/netball-icon.png";
import padelIcon from "@/assets/padel-icon.png";
import muurkaatsenIcon from "@/assets/muurkaatsen-icon.png";
import pickleballIcon from "@/assets/pickleball-icon.png";
import racquetballIcon from "@/assets/racquetball-icon.png";
import rugbyIcon from "@/assets/rugby-icon.png";
import squashIcon from "@/assets/squash-icon.png";
import sepaktakrawIcon from "@/assets/sepaktakraw-icon.png";
import tafeltennisIcon from "@/assets/tafeltennis-icon.png";
import tennisIcon from "@/assets/tennis-icon.png";
import waterpoloIcon from "@/assets/waterpolo-icon.png";
import swimmingIcon from "@/assets/swimming-icon.png";
import volleyballIcon from "@/assets/volleyball-icon.png";
import esportIcon from "@/assets/esport-icon.png";
import freestyleIcon from "@/assets/freestyle-icon.png";

const makeImageIcon = (src: string): React.ComponentType<{ size?: number; className?: string; white?: boolean }> => {
  const Component: React.ComponentType<{ size?: number; className?: string; white?: boolean }> = ({ size = 16, className, white }) => {
    const { mode } = useTheme();

    return (
      <img
        src={src}
        width={size}
        height={size}
        className={className ?? ""}
        style={{
          objectFit: "contain",
          filter: white && mode === "dark" ? "brightness(0) invert(1)" : "brightness(0)",
        }}
        alt=""
      />
    );
  };

  return Component;
};

const PetanqueIcon = makeImageIcon(petanqueIcon);
const BadmintonIcon = makeImageIcon(badmintonIcon);
const FootballIcon = makeImageIcon(footballIcon);
const AthleticsIcon = makeImageIcon(athleticsIcon);
const BasketballIcon = makeImageIcon(basketballIcon);
const BeachtennisIcon = makeImageIcon(beachtennisIcon);
const SoccerIcon = makeImageIcon(soccerIcon);
const BilliardsIcon = makeImageIcon(billiardsIcon);
const BowlingIcon = makeImageIcon(bowlingIcon);
const CricketIcon = makeImageIcon(cricketIcon);
const CurlingIcon = makeImageIcon(curlingIcon);
const WrestlingIcon = makeImageIcon(wrestlingIcon);
const DartsIcon = makeImageIcon(dartsIcon);
const FloorballIcon = makeImageIcon(floorballIcon);
const GolfIcon = makeImageIcon(golfIcon);
const BaseballIcon = makeImageIcon(baseballIcon);
const HandballIcon = makeImageIcon(handballIcon);
const HockeyIcon = makeImageIcon(hockeyIcon);
const IcehockeyIcon = makeImageIcon(icehockeyIcon);
const KorfbalIcon = makeImageIcon(korfbalIcon);
const NetballIcon = makeImageIcon(netballIcon);
const PadelIcon = makeImageIcon(padelIcon);
const MuurkaatsenIcon = makeImageIcon(muurkaatsenIcon);
const PickleballIcon = makeImageIcon(pickleballIcon);
const RacquetballIcon = makeImageIcon(racquetballIcon);
const RugbyIcon = makeImageIcon(rugbyIcon);
const SquashIcon = makeImageIcon(squashIcon);
const SepaktakrawIcon = makeImageIcon(sepaktakrawIcon);
const TafeltennisIcon = makeImageIcon(tafeltennisIcon);
const TennisIcon = makeImageIcon(tennisIcon);
const WaterpoloIcon = makeImageIcon(waterpoloIcon);
const SwimmingIcon = makeImageIcon(swimmingIcon);
const VolleyballIcon = makeImageIcon(volleyballIcon);
const EsportIcon = makeImageIcon(esportIcon);
const FreestyleIcon = makeImageIcon(freestyleIcon);

interface SportIconProps {
  sport: string;
  size?: number;
  className?: string;
  white?: boolean;
}

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string; white?: boolean }>> = {
  // Racket / paddle
  "Tennis": TennisIcon,
  "Squash": SquashIcon,
  "Beachtennis": BeachtennisIcon,
  "Padel": PadelIcon,
  "Racquetball": RacquetballIcon,
  "Badminton": BadmintonIcon,
  "Tafeltennis": TafeltennisIcon,
  "Pickleball": PickleballIcon,

  // Football family
  "Voetbal": SoccerIcon,
  "Beach soccer": SoccerIcon,
  "Freestyle voetbal": FreestyleIcon,
  "Zaalvoetbal (futsal)": SoccerIcon,

  // Volleyball family
  "Volleybal": VolleyballIcon,
  "Beachvolleybal": VolleyballIcon,
  "Netball": NetballIcon,
  "Sepak takraw": SepaktakrawIcon,

  "Basketbal": BasketballIcon,
  "Handbal": HandballIcon,

  // Hockey-stick with ball (floorball, hockey, inlinehockey)
  "Hockey": HockeyIcon,
  "Floorball": FloorballIcon,
  "Inlinehockey": HockeyIcon,
  // Ice hockey
  "IJshockey": IcehockeyIcon,

  // Baseball
  "Honkbal / Softbal": BaseballIcon,
  "Rounders": BaseballIcon,

  "Cricket": CricketIcon,
  "Golf": GolfIcon,
  "American Football": FootballIcon,
  "Flag Football": FootballIcon,
  "Rugby": RugbyIcon,

  // Combat / korfbal style figures
  "Judo": WrestlingIcon,
  "Worstelen": WrestlingIcon,
  "Korfbal": KorfbalIcon,

  "Atletiek": AthleticsIcon,
  "Zwemmen": SwimmingIcon,
  "Waterpolo": WaterpoloIcon,
  "Bowling": BowlingIcon,
  "Darts": DartsIcon,
  "Biljart": BilliardsIcon,
  "Curling": CurlingIcon,
  "Muurkaatsen": MuurkaatsenIcon,
  "Pétanque / Jeu de boules": PetanqueIcon,
  "Esport": EsportIcon,
};

const SportIcon: React.FC<SportIconProps> = ({ sport, size = 16, className, white }) => {
  const IconComponent = iconMap[sport] || MdSports;
  return <IconComponent size={size} className={className} white={white} />;
};

export default SportIcon;
