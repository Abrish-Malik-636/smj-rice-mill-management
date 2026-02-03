import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const TABS = [
  { key: "daybook", label: "Day Book" },
  { key: "ledger", label: "Ledger" },
  { key: "cash", label: "Cash In Hand" },
  { key: "expenses", label: "Expenses Report" },
  { key: "pl", label: "Profit & Loss" },
  { key: "balance", label: "Balance Sheet" },
  { key: "party-ledger", label: "Party Ledger" },
];

export default function AccountingFinance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("daybook");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TABS.some((t) => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabClick = (key) => {
    setActiveTab(key);
    setSearchParams({ tab: key });
  };

  const activeLabel = TABS.find((t) => t.key === activeTab)?.label || "Module";

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-emerald-900">
          Accounting &amp; Finance
        </h2>
        <p className="text-sm text-gray-500">
          Day book, ledgers, cash, expenses, profit &amp; loss and balance sheet.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${
              activeTab === tab.key
                ? "text-emerald-700 border-emerald-700 bg-emerald-50"
                : "text-gray-500 border-transparent hover:text-emerald-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 text-sm text-gray-600">
        {activeLabel} section will be added here.
      </div>
    </div>
  );
}
