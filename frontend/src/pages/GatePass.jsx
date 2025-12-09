// src/pages/GatePass.jsx
import React, { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import GatePassIN from "../components/GatePass/GatePassIN";
import GatePassOUT from "../components/GatePass/GatePassOUT";

export default function GatePass() {
  const [activeTab, setActiveTab] = useState("IN");
  const tabs = [
    { label: "Gate Pass Inward", value: "IN", icon: <LogIn size={16} /> },
    { label: "Gate Pass Outward", value: "OUT", icon: <LogOut size={16} /> },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-emerald-800">Gate Pass</h1>
        <p className="text-sm text-gray-500">Manage inwards and outwards.</p>
      </div>

      <div className="border-b border-emerald-200 mb-6">
        <div className="flex gap-4">
          {tabs.map((t) => {
            const isActive = activeTab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg border-b-2 transition
                  ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 font-semibold border-emerald-600"
                      : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-emerald-50"
                  }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "IN" ? <GatePassIN /> : <GatePassOUT />}
    </div>
  );
}
