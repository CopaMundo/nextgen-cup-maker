import type { ComponentProps } from "react";
import { GiWhistle } from "react-icons/gi";

const WhistleIcon = (props: ComponentProps<typeof GiWhistle>) => (
  <GiWhistle {...props} />
);

export default WhistleIcon;
