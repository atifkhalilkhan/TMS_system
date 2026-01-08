import { BABox, BAPera } from "basuite";
import { LayoutGrid } from "lucide-react";

export default function Home() {
  return (
    <BABox className="flex flex-col items-center justify-center h-[80vh] text-center">
      <div className="bg-gray-100 p-6 rounded-full mb-4">
        <LayoutGrid size={48} className="text-gray-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800">Welcome to your Workspace</h1>
      <BAPera className="text-gray-500 mt-2">
        Select a space or project from the sidebar to view your tasks.
      </BAPera>
    </BABox>
  );
}