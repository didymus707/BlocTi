import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AppRoutes } from "./components/AppRoutes.tsx";
import { BlockUIProvider } from "./context/BlockUIProvider.tsx";
import { SeiProvider } from "./sei/store/SeiProvider.tsx";
import { SeiSessionProvider } from "./sei/session/SeiSessionProvider.tsx";
import {
  createHttpPersistence,
  createLocalPersistence,
} from "./sei/store/persistence.ts";

// with VITE_API_URL set, traces live in Postgres via the backend;
// without it, everything stays in this browser's localStorage
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
const persistence = apiUrl
  ? createHttpPersistence(apiUrl.replace(/\/$/, ""))
  : createLocalPersistence();

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
