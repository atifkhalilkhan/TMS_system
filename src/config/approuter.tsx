import { BrowserRouter, Route, Routes } from "react-router";
import MainLayout from "../layouts/MainLayout";
import ProjectScreen from "../pages/ProjectScreen";
import Home from "../pages/Home";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />          
          <Route path="/project/:projectId" element={<ProjectScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}