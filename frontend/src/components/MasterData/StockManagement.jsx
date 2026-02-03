import React from "react";
import ProductManager from "./ProductManager";

export default function StockManagement() {
  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-emerald-800">
        Production Stock Management
      </div>
      <ProductManager />
    </div>
  );
}
