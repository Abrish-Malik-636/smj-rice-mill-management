import React from "react";
import { Home, Settings, Bell, BarChart2, Truck, Package, Factory, Database, X } from "lucide-react";

export default function Sidebar({ isOpen, toggleSidebar }) {
  return (
    <div
      className={`fixed top-0 left-0 h-full bg-emerald-800 text-white shadow-xl transform ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } transition-transform duration-300 ease-in-out w-1/4 z-50`}
    >
      <div className="flex justify-between items-center p-4 border-b border-emerald-700">
        <h1 className="text-2xl font-bold tracking-wide">🌾 SMJ</h1>
        <button onClick={toggleSidebar} className="text-white hover:text-emerald-300">
          <X size={22} />
        </button>
      </div>

      <div className="flex flex-col mt-4 space-y-3 px-4">
        {[
          { name: "Dashboard", icon: <Home size={18} /> },
          { name: "Financial", icon: <BarChart2 size={18} /> },
          { name: "IN/OUT Gate Pass", icon: <Truck size={18} /> },
          { name: "Stock", icon: <Package size={18} /> },
          { name: "Production", icon: <Factory size={18} /> },
          { name: "Reports", icon: <Database size={18} /> },
          { name: "Notifications", icon: <Bell size={18} /> },
          { name: "Master Data", icon: <Settings size={18} /> },
        ].map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-700 cursor-pointer transition"
          >
            {item.icon}
            <span>{item.name}</span>
          </div>
        ))}
      </div>

      {/* Footer (user info placeholder) */}
      <div className="absolute bottom-0 left-0 w-full p-4 border-t border-emerald-700">
        <p className="text-sm text-emerald-200">👤 Admin User</p>
        <p className="text-xs text-emerald-300">admin@smjrice.pk</p>
      </div>
    </div>
  );
}
