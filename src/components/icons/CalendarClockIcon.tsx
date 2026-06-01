import { SVGProps } from "react";

const CalendarClockIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
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
    {/* Calendar body */}
    <path d="M280 432 H100 a48 48 0 0 1 -48 -48 V128 a48 48 0 0 1 48 -48 H372 a48 48 0 0 1 48 48 V260" />
    {/* Top binding bar */}
    <line x1="52" y1="180" x2="420" y2="180" />
    {/* Left ring */}
    <line x1="140" y1="48" x2="140" y2="112" />
    {/* Right ring */}
    <line x1="332" y1="48" x2="332" y2="112" />
    {/* Clock circle */}
    <circle cx="356" cy="356" r="100" />
    {/* Clock hands */}
    <line x1="356" y1="312" x2="356" y2="356" />
    <line x1="356" y1="356" x2="392" y2="380" />
  </svg>
);

export default CalendarClockIcon;
