import { SVGProps } from "react";

const ShirtIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
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
    {/* Shirt outline: shoulders, sleeves and body */}
    <path d="M180 60 L60 100 L20 200 L120 240 L120 460 L392 460 L392 240 L492 200 L452 100 L332 60 C320 100 290 130 256 130 C222 130 192 100 180 60 Z" />
  </svg>
);

export default ShirtIcon;
