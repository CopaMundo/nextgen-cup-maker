import { SVGProps } from "react";

const ChampionsTrophyIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    fill="currentColor"
    className={className}
    {...props}
  >
    {/* Top bar */}
    <rect x="150" y="40" width="212" height="50" />
    {/* Cup body with carved-out handles */}
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M90 70 H422 C452 70 472 95 470 130 C465 220 410 300 320 320 L300 380 H330 C360 380 380 405 380 435 V490 H132 V435 C132 405 152 380 182 380 H212 L192 320 C102 300 47 220 42 130 C40 95 60 70 90 70 Z M110 120 C108 200 145 265 205 285 L165 130 C165 124 160 120 154 120 H110 Z M402 120 H358 C352 120 347 124 347 130 L307 285 C367 265 404 200 402 120 Z"
    />
  </svg>
);

export default ChampionsTrophyIcon;
