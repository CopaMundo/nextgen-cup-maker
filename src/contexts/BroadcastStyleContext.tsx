import { createContext, useContext } from "react";
import type { BroadcastStyle } from "@/lib/broadcastStyles";

const BroadcastStyleContext = createContext<BroadcastStyle>("espn");

export const useBroadcastStyle = () => useContext(BroadcastStyleContext);

export default BroadcastStyleContext;
