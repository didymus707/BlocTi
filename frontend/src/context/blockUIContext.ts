import { createContext, useContext } from "react";
import type { BlockUIContextType } from "../types";

export const BlockUIContext = createContext<BlockUIContextType | undefined>(
  undefined,
);

export const useBlockUI = () => {
  const context = useContext(BlockUIContext);
  if (!context)
    throw new Error("useBlockUI must be used within BlockUIProvider");
  return context;
};
