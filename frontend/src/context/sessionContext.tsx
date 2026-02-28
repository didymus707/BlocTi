import { createContext, useContext } from "react";
import type { SessionContextType } from "../types";

export const SessionContext = createContext<SessionContextType>({
  activeBlock: null,
  activeBlockId: null,
  activeTaskId: null,
  start: () => {},
  pause: () => {},
  reset: () => {},
  resume: () => {},
  sessionTime: { elapsed: 0, remaining: 0, progress: 0 },
});

export const useSession = () => useContext(SessionContext);
