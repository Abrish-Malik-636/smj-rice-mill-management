// src/pages/MasterData.jsx
import React, { useState } from "react";

export default function MasterData() {
  const [activeTab, setActiveTab] = useState("companies");

  const tabs = [
    { key: "companies", label: "Companies" },
    { key: "products", label: "Product Types" },
    { key: "expenses", label: "Expense Categories" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}

      {/* Tabs */}
      <div className="flex space-x-3 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 font-medium rounded-t-lg transition-all duration-300 ${
              activeTab === tab.key
                ? "bg-emerald-600 text-white shadow"
                : "bg-gray-100 text-gray-700 hover:bg-emerald-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white p-6 rounded-xl shadow-md transition-all duration-300">
        {activeTab === "companies" && <CompanySection />}
        {activeTab === "products" && <ProductSection />}
        {activeTab === "expenses" && <ExpenseSection />}
      </div>
    </div>
  );
}

/* 🏢 Company Tab Placeholder */
function CompanySection() {
  return (
    <div className="text-center text-gray-500 py-12">
      <p className="text-lg font-medium mb-2">
        🏢 Company management module coming soon...
      </p>
      <p className="text-sm">
        Add, update, or view company details in this section.
      </p>
    </div>
  );
}

/* 📦 Product Types Tab Placeholder */
function ProductSection() {
  return (
    <div className="text-center text-gray-500 py-12">
      <p className="text-lg font-medium mb-2">
        📦 Product types setup coming soon...
      </p>
      <p className="text-sm">
        Manage all types of products and categories here.
      </p>
    </div>
  );
}

/* 💸 Expense Categories Tab Placeholder */
function ExpenseSection() {
  return (
    <div className="text-center text-gray-500 py-12">
      <p className="text-lg font-medium mb-2">
        💸 Expense categories coming soon...
      </p>
      <p className="text-sm">
        Define and control all expense category types here.
      </p>
    </div>
  );
}
