import { createContext, useContext } from "react";
import type { BroadcastStyle } from "@/lib/broadcastStyles";

const BroadcastStyleContext = createContext<BroadcastStyle>("copa_mundo_bc");

export const useBroadcastStyle = () => useContext(BroadcastStyleContext);

export default BroadcastStyleContext;
