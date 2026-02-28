import { createContext, useContext } from "react";
import type { BlockContextType, BlockUIContextType } from "../types";

export const BlockContext = createContext<BlockContextType>({
  blocks: [],
  dispatch: () => {},
});

export const BlockUIContext = createContext<BlockUIContextType | undefined>(
  undefined
);

export const useBlock = () => useContext(BlockContext);

export const useBlockUI = () => {
  const context = useContext(BlockUIContext);
  if (!context)
    throw new Error("useBlockUI must be used within BlockUIProvider");
  return context;
};
