// src/layouts/MainLayout.jsx
import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";

export default function MainLayout({ children }) {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();

  // 🧭 Map route paths to module names
  const routeTitles = {
    "/": "Dashboard",
    "/financial": "Financial",
    "/gatepass": "IN/OUT Gate Pass",
    "/stock": "Stock Management",
    "/production": "Production",
    "/reports": "Reports",
    "/notifications": "Notifications",
    "/masterdata": "Master Data",
  };

  // Get current module name, default if unknown
  const currentPage = routeTitles[location.pathname] || "Dashboard";

  const toggleSidebar = () => setIsOpen((prev) => !prev);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={isOpen} toggleSidebar={toggleSidebar} />

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isOpen ? "ml-[25%]" : "ml-16"
        }`}
      >
        {/* Top Bar */}
        <div className="flex items-center bg-white shadow px-6 py-3 sticky top-0 z-40">
          <button
            onClick={toggleSidebar}
            className="text-emerald-700 hover:text-emerald-900 focus:outline-none mr-4"
            aria-label="Toggle Sidebar"
          >
            ☰
          </button>
          <h2 className="text-lg font-semibold text-emerald-800">
            SMJ Rice Mill — {currentPage}
          </h2>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
