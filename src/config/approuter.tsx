import { HashRouter, Route, Routes } from "react-router"
import MainLayout from "../layouts/MainLayout";
import ProjectScreen from "../pages/ProjectScreen";
import Home from "../pages/Home";

export default function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/space/:spaceId/project/:projectId" element={<ProjectScreen />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}