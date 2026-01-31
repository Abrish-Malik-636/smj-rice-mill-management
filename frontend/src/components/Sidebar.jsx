// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

import {
  Home,
  Wallet,
  Box,
  Settings,
  BarChart2,
  Truck,
  Bell,
  User,
  LogOut,
  FactoryIcon,
  Menu,
  Lightbulb,
} from "lucide-react";

export default function Sidebar({ isOpen, toggleSidebar }) {
  const location = useLocation();

  const menu = [
    { name: "Dashboard", icon: <Home size={18} />, path: "/" },

    {
      name: "Accounts & Finance",
      icon: <Wallet size={18} />,
      path: "/financial",
    },

    {
      name: "Stock Management",
      icon: <Box size={18} />,
      path: "/stock",
    },

    {
      name: "Gate Pass Management",
      icon: <Truck size={18} />,
      path: "/gatepass",
    },

    {
      name: "Production Management",
      icon: <FactoryIcon size={18} />,
      path: "/production",
    },

    {
      name: "Reports & Analytics",
      icon: <BarChart2 size={18} />,
      path: "/reports",
    },

    {
      name: "Notifications & Alerts",
      icon: <Bell size={18} />,
      path: "/notifications",
    },

    {
      name: "System Setup",
      icon: <Settings size={18} />,
      path: "/masterdata", // backend unchanged
    },

    {
      name: "AI Assistant",
      icon: <Lightbulb className="w-5 h-5" />,
      path: "/ai/suggestions",
    },
  ];

  return (
    <>
      {/* BACKDROP FOR MOBILE */}
      {isOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 
          bg-gradient-to-b from-teal-700 to-emerald-900 text-white shadow-xl overflow-hidden
          transition-transform duration-300 ease-in-out
          ${isOpen ? "md:w-64" : "md:w-16"}
          ${
            isOpen
              ? "translate-x-0 w-64"
              : "-translate-x-full w-64 md:translate-x-0"
          }
        `}
      >
        <div className="h-full flex flex-col justify-between">
          {/* TOP */}
          <div>
            <div className="flex items-center gap-3 px-4 py-4 border-b border-emerald-700">
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg bg-emerald-800/40 hover:bg-emerald-800 transition"
              >
                <Menu size={18} />
              </button>

              {isOpen && (
                <div>
                  <h1 className="text-lg font-bold">SMJ Rice Mill</h1>
                  <p className="text-xs text-emerald-200">
                    Mirza Virkan Road, Sheikhupura
                  </p>
                </div>
              )}
            </div>

            {/* MENU */}
            <nav className="px-2 py-4 space-y-1">
              {menu.map((m) => {
                const active = location.pathname === m.path;
                return (
                  <Link
                    key={m.name}
                    to={m.path}
                    onClick={() => {
                      if (window.innerWidth < 768 && isOpen) toggleSidebar();
                    }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition
                      ${
                        active
                          ? "bg-emerald-600 text-white"
                          : "hover:bg-emerald-700 text-emerald-100"
                      }
                      ${isOpen ? "" : "justify-center"}
                    `}
                  >
                    {m.icon}
                    {isOpen && <span className="text-sm">{m.name}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* PROFILE */}
          <div className="px-3 py-4 border-t border-emerald-700">
            <div
              className={`flex items-center gap-3 ${isOpen ? "" : "flex-col"}`}
            >
              <div className="bg-emerald-600 p-1 rounded-full">
                <User size={20} />
              </div>

              {isOpen && (
                <div>
                  <div className="text-sm font-semibold">Admin User</div>
                  <div className="text-xs text-emerald-200">
                    admin@smjrice.pk
                  </div>
                </div>
              )}

              <button className="text-emerald-200 hover:text-white p-2 rounded">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
