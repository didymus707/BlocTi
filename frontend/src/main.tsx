import "./index.css";
import App from "./components/App.tsx";
import { StrictMode } from "react";
import { Home } from "./pages/home.tsx";
import { createRoot } from "react-dom/client";
import { CardDetails } from "./pages/blockCardDetail.tsx";
import { BrowserRouter, Route, Routes } from "react-router";
import {
  BlockProvider,
  BlockUIProvider,
} from "./context/blockContextProvider.tsx";
import { SessionProvider } from "./context/sessionManager.tsx";

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <BlockProvider>
        <SessionProvider>
          <BlockUIProvider>
            <Routes>
              <Route path="/" element={<App />}>
                <Route index element={<Home />} />
                <Route path="block/:id" element={<CardDetails />} />
              </Route>
            </Routes>
          </BlockUIProvider>
        </SessionProvider>
      </BlockProvider>
    </BrowserRouter>
  </StrictMode>
);
