import { SVGProps } from "react";

const ScoreboardIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    fill="none"
    stroke="currentColor"
    strokeWidth={32}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Outer scoreboard frame */}
    <rect x="20" y="100" width="472" height="312" rx="20" />
    {/* Left "0" */}
    <rect x="80" y="170" width="100" height="172" rx="24" />
    {/* Right "0" */}
    <rect x="332" y="170" width="100" height="172" rx="24" />
    {/* Colon - top dot */}
    <line x1="256" y1="200" x2="256" y2="232" />
    {/* Colon - bottom dot */}
    <line x1="256" y1="280" x2="256" y2="312" />
  </svg>
);

export default ScoreboardIcon;
