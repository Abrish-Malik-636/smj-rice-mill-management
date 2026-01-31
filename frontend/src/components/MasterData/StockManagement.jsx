import React, { useState } from "react";
import { Package, Cog } from "lucide-react";
import ProductManager from "./ProductManager";
import ManagerialStockManager from "./ManagerialStockManager";

export default function StockManagement() {
  const [activeSubTab, setActiveSubTab] = useState("production");

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-gray-200 mb-4">
        <button
          type="button"
          onClick={() => setActiveSubTab("production")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            activeSubTab === "production"
              ? "text-emerald-700 border-emerald-700"
              : "text-gray-500 border-transparent hover:text-emerald-600"
          }`}
        >
          <Package size={18} />
          Production Stock
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("managerial")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            activeSubTab === "managerial"
              ? "text-emerald-700 border-emerald-700"
              : "text-gray-500 border-transparent hover:text-emerald-600"
          }`}
        >
          <Cog size={18} />
          Managerial Stock
        </button>
      </div>

      {activeSubTab === "production" && <ProductManager />}
      {activeSubTab === "managerial" && <ManagerialStockManager />}
    </div>
  );
}
