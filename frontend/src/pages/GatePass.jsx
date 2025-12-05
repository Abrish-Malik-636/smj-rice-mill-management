// src/pages/GatePass.jsx
import React, { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import GatePassIN from "../components/GatePass/GatePassIN";
import GatePassOUT from "../components/GatePass/GatePassOUT";

/**
 * Simple Master-Data style header + tabs container
 * Heading style = Option 1 (Master Data look)
 */

export default function GatePass() {
  const [activeTab, setActiveTab] = useState("IN");

  const tabs = [
    { label: "IN Gate Pass", value: "IN", icon: <LogIn size={16} /> },
    { label: "OUT Gate Pass", value: "OUT", icon: <LogOut size={16} /> },
  ];

  return (
    <div className="w-full">
      {/* Page Header (Master Data style) */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-emerald-800">
            Gate Pass Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage IN / OUT gate passes
          </p>
        </div>
      </div>

      {/* Tabs (Master Data style) */}
      <div className="flex space-x-6 border-b border-emerald-200 pb-3 mb-6">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTab(t.value)}
            className={`flex items-center gap-2 pb-2 transition ${
              activeTab === t.value
                ? "text-emerald-700 font-semibold border-b-2 border-emerald-700"
                : "text-gray-500 hover:text-emerald-600"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div>{activeTab === "IN" ? <GatePassIN /> : <GatePassOUT />}</div>
    </div>
  );
}
