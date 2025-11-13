// src/pages/MasterData.jsx
import React, { useState } from "react";
import { Building2, Wheat, Wallet2, Settings, Users } from "lucide-react";
import CompanyManager from "../components/MasterData/CompanyManager";
import ProductManager from "../components/MasterData/ProductManager";
import ExpenseCategoryManager from "../components/MasterData/ExpenseCategoryManager";
import SystemSettings from "../components/MasterData/SystemSettings";

export default function MasterData() {
  const [activeTab, setActiveTab] = useState("company");

  const tabs = [
    {
      key: "company",
      label: "Company Management",
      icon: <Building2 size={18} />,
    },
    { key: "product", label: "Product Types", icon: <Wheat size={18} /> },
    {
      key: "expense",
      label: "Expense Categories",
      icon: <Wallet2 size={18} />,
    },
    { key: "system", label: "System Settings", icon: <Settings size={18} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold text-emerald-900">
          Master Data & Settings
        </h2>
        <p className="text-gray-500 text-sm">
          Manage companies, products, system configuration and users
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 ${
              activeTab === tab.key
                ? "text-emerald-700 border-emerald-700 bg-emerald-50"
                : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-gray-50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {activeTab === "company" && <CompanyManager />}
        {activeTab === "product" && <ProductManager />}
        {activeTab === "expense" && <ExpenseCategoryManager />}
        {activeTab === "system" && <SystemSettings />}
      </div>
    </div>
  );
}
