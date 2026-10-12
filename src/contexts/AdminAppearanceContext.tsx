import { createContext, useContext } from "react";

/** Carries management styling through Radix portals without affecting public views. */
export const AdminAppearanceContext = createContext(false);
export const useAdminAppearance = () => useContext(AdminAppearanceContext);