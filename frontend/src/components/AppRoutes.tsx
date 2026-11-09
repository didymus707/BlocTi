import { Route, Routes } from "react-router";
import App from "./App";
import { Home } from "../pages/home";
import { CardDetails } from "../pages/blockCardDetail";

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<App />}>
      <Route index element={<Home />} />
      <Route path="block/:id" element={<CardDetails />} />
    </Route>
  </Routes>
);
