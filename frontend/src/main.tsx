import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AppRoutes } from "./components/AppRoutes.tsx";
import { BlockUIProvider } from "./context/BlockUIProvider.tsx";
import { SeiProvider } from "./sei/store/SeiProvider.tsx";
import { SeiSessionProvider } from "./sei/session/SeiSessionProvider.tsx";
import { createLocalPersistence } from "./sei/store/persistence.ts";

// traces live in this browser's localStorage
const persistence = createLocalPersistence();

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <SeiProvider persistence={persistence}>
        <SeiSessionProvider>
          <BlockUIProvider>
            <AppRoutes />
          </BlockUIProvider>
        </SeiSessionProvider>
      </SeiProvider>
    </BrowserRouter>
  </StrictMode>,
);
