// src/pages/MasterData.jsx
import React, { useState } from "react";
import { Building2, Wheat, Wallet2, Settings, Users } from "lucide-react";
import CompanyManager from "../components/MasterData/CompanyManager";

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
    { key: "users", label: "User Management", icon: <Users size={18} /> },
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
        {activeTab === "product" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-emerald-800">
                🌾 Product Types
              </h3>
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-sm">
                + Add Product Type
              </button>
            </div>
            <p className="text-gray-500 text-sm">
              Define product categories and rice types for inventory tracking.
            </p>
          </div>
        )}

        {activeTab === "expense" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-emerald-800">
                💵 Expense Categories
              </h3>
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-sm">
                + Add Expense Category
              </button>
            </div>
            <p className="text-gray-500 text-sm">
              Organize expense types such as maintenance, fuel, and utilities.
            </p>
          </div>
        )}

        {activeTab === "system" && (
          <div>
            <h3 className="text-lg font-semibold text-emerald-800 mb-4">
              ⚙️ System Settings
            </h3>
            <form className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Mill Name
                </label>
                <input
                  type="text"
                  defaultValue="SMJ Rice Mill"
                  className="w-full border rounded px-2 py-1 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Owner Name
                </label>
                <input
                  type="text"
                  defaultValue="Muhammad Jameel"
                  className="w-full border rounded px-2 py-1 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-600 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  defaultValue="Mirza Virkan Road, Near Band Sheikhupura"
                  className="w-full border rounded px-2 py-1 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1 rounded text-sm">
                  💾 Save Settings
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "users" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-emerald-800">
                👤 User Management
              </h3>
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-sm">
                + Add New User
              </button>
            </div>
            <table className="w-full text-sm border">
              <thead className="bg-emerald-50 text-emerald-700">
                <tr>
                  <th className="p-2 text-left">Username</th>
                  <th className="p-2 text-left">Role</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-2 font-medium">admin</td>
                  <td className="p-2">Administrator</td>
                  <td className="p-2">admin@smjrice.pk</td>
                  <td className="p-2 text-green-600 font-semibold">Active</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
