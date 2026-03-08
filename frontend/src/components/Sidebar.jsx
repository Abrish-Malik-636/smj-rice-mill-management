// src/components/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  Home,
  Wallet,
  Box,
  BarChart3,
  Settings,
  Truck,
  Bell,
  User,
  LogOut,
  FactoryIcon,
  Menu,
  Lightbulb,
  ChevronDown,
  HandCoins,
  ChartNoAxesCombined,
  BriefcaseBusiness,
  ShieldAlert,
  Bot,
} from "lucide-react";

const MENU = [
  { name: "Dashboard", icon: <Home size={18} />, path: "/" },
  {
    name: "Gate Pass Management",
    icon: <Truck size={18} />,
    path: "/gatepass",
    children: [
      { name: "Gate Pass Inward", path: "/gatepass?tab=IN" },
      { name: "Gate Pass Outward", path: "/gatepass?tab=OUT" },
    ],
  },
  {
    name: "Sales & Purchases",
    icon: <HandCoins size={18} />,
    path: "/financial",
    children: [
      { name: "Sales", path: "/financial?tab=sale" },
      { name: "Purchases", path: "/financial?tab=purchase" },
    ],
  },
  {
    name: "Production Management",
    icon: <FactoryIcon size={18} />,
    path: "/production",
  },
  {
    name: "Stock Management",
    icon: <Box size={18} />,
    path: "/stock",
    children: [
      { name: "Production Stock", path: "/stock" },
      { name: "Managerial Stock", path: "/stock-managerial" },
    ],
  },
  {
    name: "Accounting & Finance",
    icon: <BriefcaseBusiness size={18} />,
    path: "/accounting-finance",
    children: [
      { name: "Day Book", path: "/accounting-finance?tab=daybook" },
      { name: "Ledger", path: "/accounting-finance?tab=ledger" },
      { name: "Cash In Hand", path: "/accounting-finance?tab=cash" },
      { name: "Expenses Report", path: "/accounting-finance?tab=expenses" },
      { name: "Profit & Loss", path: "/accounting-finance?tab=pl" },
      { name: "Balance Sheet", path: "/accounting-finance?tab=balance" },
      { name: "Trial Balance", path: "/accounting-finance?tab=trial" },
      { name: "Receivables", path: "/accounting-finance?tab=receivables" },
      { name: "Payables", path: "/accounting-finance?tab=payables" },
      { name: "Party Ledger", path: "/accounting-finance?tab=party-ledger" },
      { name: "Journal", path: "/accounting-finance?tab=journal" },
      { name: "Accounts", path: "/accounting-finance?tab=accounts" },
    ],
  },
  {
    name: "Reports",
    icon: <ChartNoAxesCombined size={18} />,
    path: "/reports",
    children: [
      { name: "Stock Report", path: "/reports?tab=stock" },
      { name: "Production Report", path: "/reports?tab=production" },
      { name: "Sales Report", path: "/reports?tab=sales" },
      { name: "Purchase Report", path: "/reports?tab=purchases" },
      { name: "P&L", path: "/reports?tab=pl" },
      { name: "Trial Balance", path: "/reports?tab=trial" },
      { name: "Balance Sheet", path: "/reports?tab=balance" },
      { name: "Receivables", path: "/reports?tab=receivables" },
      { name: "Payables", path: "/reports?tab=payables" },
      { name: "Day Book", path: "/reports?tab=daybook" },
      { name: "Ledger", path: "/reports?tab=ledger" },
      { name: "Customer Report", path: "/reports?tab=customers" },
      { name: "Brand Report", path: "/reports?tab=brands" },
    ],
  },
  {
    name: "HR & Payroll",
    icon: <User size={18} />,
    path: "/hr-payroll",
  },
  {
    name: "Notifications & Alerts",
    icon: <ShieldAlert size={18} />,
    path: "/notifications",
  },
  {
    name: "System Settings",
    icon: <Settings size={18} />,
    path: "/masterdata?tab=system",
  },
];

export default function Sidebar({ isOpen, toggleSidebar, userName, userEmail, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    const current = location.pathname + location.search;
    const parent = MENU.find(
      (m) => m.children && m.children.some((c) => c.path === current),
    );
    if (parent) setOpenMenu(parent.name);
  }, [location.pathname, location.search]);

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
          bg-gradient-to-b from-teal-700 to-emerald-900 text-white shadow-xl
          transition-transform duration-300 ease-in-out
          ${isOpen ? "md:w-64" : "md:w-16"}
          ${
            isOpen
              ? "translate-x-0 w-64"
              : "-translate-x-full w-64 md:translate-x-0"
          }
        `}
      >
        <div className="h-full flex flex-col">
          {/* TOP */}
          <div className="flex flex-col min-h-0">
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
            <nav className="px-2 py-4 space-y-1 overflow-y-auto no-scrollbar flex-1 min-h-0 scroll-smooth">
              {MENU.map((m) => {
                const currentRoute = location.pathname + location.search;
                const active =
                  location.pathname === m.path || currentRoute === m.path;
                const isExpanded = openMenu === m.name;
                const hasChildren =
                  Array.isArray(m.children) && m.children.length > 0;
                return (
                  <div key={m.name} className="space-y-1">
                    {hasChildren ? (
                      <button
                        type="button"
                        title={!isOpen ? m.name : ""}
                        onClick={() => {
                          setOpenMenu((prev) =>
                            prev === m.name ? null : m.name,
                          );
                          if (m.children && m.children[0]) {
                            navigate(m.children[0].path);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition
                          ${
                            active
                              ? "bg-emerald-600 text-white"
                              : "hover:bg-emerald-700 text-emerald-100"
                          }
                          ${isOpen ? "" : "justify-center"}
                        `}
                      >
                        {m.icon}
                        {isOpen && (
                          <>
                            <span className="text-sm flex-1 text-left">
                              {m.name}
                            </span>
                            <ChevronDown
                              size={16}
                              className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </>
                        )}
                      </button>
                    ) : (
                      <Link
                        to={m.path}
                        title={!isOpen ? m.name : ""}
                        onClick={() => {
                          if (window.innerWidth < 768 && isOpen)
                            toggleSidebar();
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
                    )}

                    {hasChildren && isOpen && (
                      <div
                        className={`ml-8 mt-1 overflow-hidden border-l border-emerald-400/40 pl-2 transition-all duration-300 ease-out ${
                          isExpanded
                            ? "max-h-96 opacity-100"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="space-y-1 py-1">
                          {m.children.map((c) => {
                            const childActive =
                              location.pathname + location.search === c.path;
                            return (
                              <Link
                                key={c.name}
                                to={c.path}
                                onClick={() => {
                                  if (window.innerWidth < 768 && isOpen)
                                    toggleSidebar();
                                }}
                                className={`block px-2.5 py-1.5 rounded-md text-xs transition
                                ${
                                  childActive
                                    ? "bg-emerald-600/90 text-white"
                                    : "text-emerald-100 hover:bg-emerald-700/60"
                                }
                              `}
                              >
                                <span className="block">{c.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* PROFILE */}
          <div className="px-3 py-4 border-t border-emerald-700 mt-auto">
          <div
            className={`flex items-center gap-3 ${isOpen ? "" : "flex-col"}`}
          >
              <button
                type="button"
                className="bg-emerald-600 p-1 rounded-full"
                onClick={() => navigate("/masterdata?tab=system")}
                title="System Settings"
              >
                <User size={20} />
              </button>

              {isOpen && (
                <div>
                  <div className="text-sm font-semibold">{userName || "Admin User"}</div>
                  <div className="text-xs text-emerald-200">
                    {userEmail || "admin@smjrice.pk"}
                  </div>
                </div>
              )}

              <button
                className="text-emerald-200 hover:text-white p-2 rounded"
                onClick={onLogout}
                type="button"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
