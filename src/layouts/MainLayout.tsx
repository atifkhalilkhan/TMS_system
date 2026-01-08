import Sidebar from "../components/Sidebar"; 
import { Outlet } from "react-router";

export default function MainLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      <Sidebar />

      <main className="flex-1 ml-64 overflow-y-auto bg-[#F4F5F7]">
        <Outlet /> 
      </main>
    </div>
  );
}