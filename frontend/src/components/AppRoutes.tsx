import { Route, Routes } from "react-router";
import App from "./App";
import { Today } from "../pages/Today";
import { Blocks } from "../pages/Blocks";
import { BlockPage } from "../pages/BlockPage";
import { AgentSessions } from "../pages/AgentSessions";
import { Reports } from "../pages/Reports";
import { Focus } from "../pages/Focus";

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<App />}>
      <Route index element={<Today />} />
      <Route path="blocks" element={<Blocks />} />
      <Route path="block/:id" element={<BlockPage />} />
      <Route path="agents" element={<AgentSessions />} />
      <Route path="reports" element={<Reports />} />
    </Route>
    {/* focus mode takes the whole screen, outside the shell */}
    <Route path="focus/:id?" element={<Focus />} />
  </Routes>
);
