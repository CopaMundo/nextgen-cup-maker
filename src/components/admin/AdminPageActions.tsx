import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const AdminPageActionsContext = createContext<HTMLElement | null>(null);

/** Move desktop controls into the workspace header without lifting feature state. */
export function AdminPageActions({ children }: { children: ReactNode }) {
  const target = useContext(AdminPageActionsContext);
  return target ? createPortal(children, target) : children;
}