import React from "react";

interface BracketTreeIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

const BracketTreeIcon = ({ size = 24, ...props }: BracketTreeIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Left side: 4 slots */}
    <line x1="2" y1="3" x2="5" y2="3" />
    <line x1="2" y1="9" x2="5" y2="9" />
    <line x1="2" y1="15" x2="5" y2="15" />
    <line x1="2" y1="21" x2="5" y2="21" />

    {/* Round 1 connectors */}
    <polyline points="5,3 7,3 7,9 5,9" />
    <polyline points="5,15 7,15 7,21 5,21" />

    {/* Round 1 to Round 2 */}
    <line x1="7" y1="6" x2="10" y2="6" />
    <line x1="7" y1="18" x2="10" y2="18" />

    {/* Round 2 connectors */}
    <polyline points="10,6 12,6 12,18 10,18" />

    {/* Final */}
    <line x1="12" y1="12" x2="18" y2="12" />
  </svg>
);

export default BracketTreeIcon;
