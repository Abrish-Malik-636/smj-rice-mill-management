// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

import {
  Home,
  Wallet,
  Truck,
  Box,
  Settings,
  BarChart2,
  Bell,
  Database,
  User,
  LogOut,
} from "lucide-react";

export default function Sidebar({ isOpen, toggleSidebar }) {
  const location = useLocation();

  const menu = [
    { name: "Dashboard", icon: <Home size={18} />, path: "/" },
    { name: "Financial", icon: <Wallet size={18} />, path: "/financial" },
    { name: "IN/OUT Gate Pass", icon: <Truck size={18} />, path: "/gatepass" },
    { name: "Stock", icon: <Box size={18} />, path: "/stock" },
    { name: "Production", icon: <Database size={18} />, path: "/production" },
    { name: "Reports", icon: <BarChart2 size={18} />, path: "/reports" },
    { name: "Notifications", icon: <Bell size={18} />, path: "/notifications" },
    { name: "Master Data", icon: <Settings size={18} />, path: "/masterdata" },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-full z-50 transform transition-all duration-300 ease-in-out
      ${isOpen ? "translate-x-0 w-1/4" : "w-16"}
      bg-gradient-to-b from-teal-700 to-emerald-900 text-white shadow-lg overflow-hidden`}
    >
      <div className="h-full flex flex-col justify-between">
        {/* Top Section */}
        <div>
          <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-700">
            {isOpen && (
              <div className="flex flex-col">
                <div className="text-lg font-bold tracking-wide">
                  SMJ Rice Mill
                </div>
                <div className="text-xs text-emerald-200">
                  Mirza Virkan Road, Sheikhupura
                </div>
              </div>
            )}
            {/* Toggle button placeholder for now */}
          </div>

          {/* Menu */}
          <nav className="px-2 py-4 space-y-1">
            {menu.map((m) => {
              const active = location.pathname === m.path;
              return (
                <Link
                  key={m.name}
                  to={m.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                    active
                      ? "bg-emerald-600 text-white shadow-inner"
                      : "hover:bg-emerald-700 text-emerald-100"
                  } ${isOpen ? "" : "justify-center"}`}
                >
                  <div>{m.icon}</div>
                  {isOpen && <span className="text-sm">{m.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: Profile */}
        <div className="px-3 py-4 border-t border-emerald-700">
          <div
            className={`flex items-center gap-3 ${isOpen ? "" : "flex-col"}`}
          >
            <div className="bg-emerald-600 p-1 rounded-full">
              <User size={20} />
            </div>
            {isOpen && (
              <div className="flex-1">
                <div className="text-sm font-semibold">Admin User</div>
                <div className="text-xs text-emerald-200">admin@smjrice.pk</div>
              </div>
            )}
            <button className="text-emerald-200 hover:text-white p-2 rounded">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
