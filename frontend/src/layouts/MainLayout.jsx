import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import { Menu } from "lucide-react";
import Dashboard from "../pages/Dashboard";

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Sidebar toggle button (fixed top-left) */}
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 bg-emerald-600 text-white p-2 rounded-md shadow-md hover:bg-emerald-700 z-40"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Main Content */}
      <main
        className={`transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "ml-[25%] w-[75%]" : "ml-0 w-full"
        } p-6`}
      >
        <Dashboard />
      </main>
    </div>
  );
}
