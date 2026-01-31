import React, { useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Download, Printer, Filter, X, Eye } from "lucide-react";
import * as XLSX from "xlsx";

const PAGE_SIZES = [5, 10, 25, 50, 100];

/**
 * Reusable data table with:
 * - Pagination
 * - Search
 * - Column filters (dropdowns where columns have filterOptions)
 * - Export to Excel
 * - Print
 * columns: [{ key, label, filterOptions?: string[] }]
 * data: array of row objects
 * idKey: key for row id (default '_id')
 */
export default function DataTable({
  columns = [],
  data = [],
  idKey = "_id",
  title = "Data",
  searchPlaceholder = "Search...",
  emptyMessage = "No records found",
  pageSize: initialPageSize = 10,
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const filteredData = useMemo(() => {
    let result = [...data];
    if (search.trim()) {
      const s = search.toLowerCase().trim();
      result = result.filter((row) =>
        columns.some((col) => {
          const val = row[col.key];
          return val != null && String(val).toLowerCase().includes(s);
        })
      );
    }
    columns.forEach((col) => {
      if (col.filterOptions && filters[col.key]) {
        result = result.filter((row) => String(row[col.key]) === filters[col.key]);
      }
    });
    return result;
  }, [data, search, columns, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageData = filteredData.slice(start, start + pageSize);

  const setFilter = (key, value) => {
    setFilters((prev) => (value ? { ...prev, [key]: value } : { ...prev, [key]: undefined }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSearch("");
    setPage(1);
  };

  const hasActiveFilters = search.trim() || Object.values(filters).some(Boolean);

  const exportColumns = columns.filter((c) => !c.skipExport);

  const exportExcel = () => {
    const headers = exportColumns.map((c) => c.label);
    const rows = filteredData.map((row) =>
      exportColumns.map((c) => (c.render ? c.render(row[c.key], row) : row[c.key] ?? ""))
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.replace(/\s/g, "_").slice(0, 31));
    XLSX.writeFile(wb, `${title.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const openPrintPreview = () => setShowPrintPreview(true);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const tableHtml = document.getElementById("data-table-print")?.outerHTML ?? "";
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background: #ecfdf5; color: #065f46; }
          </style>
        </head>
        <body>
          <h2>${title}</h2>
          <p>Printed on ${new Date().toLocaleString()}</p>
          ${tableHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
    setShowPrintPreview(false);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar: search, filters, export, print */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((p) => !p)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm ${
            hasActiveFilters ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Filter size={16} /> Filter
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
          >
            <X size={16} /> Clear
          </button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download size={16} /> Export Excel
          </button>
          <button
            type="button"
            onClick={openPrintPreview}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Eye size={16} /> Print Preview
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-900">Print Preview — {title}</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                >
                  <Printer size={16} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintPreview(false)}
                  className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <p className="text-sm text-gray-500 mb-2">Printed on {new Date().toLocaleString()}</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-emerald-50 text-emerald-800">
                    <tr>
                      {exportColumns.map((col) => (
                        <th key={col.key} className="p-2 text-left font-medium whitespace-nowrap">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((row) => (
                      <tr key={row[idKey]} className="border-t border-gray-100">
                        {exportColumns.map((col) => (
                          <td key={col.key} className="p-2">{col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          {columns.map(
            (col) =>
              col.filterOptions?.length > 0 && (
                <div key={col.key}>
                  <label className="block text-xs text-gray-500 mb-1">{col.label}</label>
                  <select
                    value={filters[col.key] ?? ""}
                    onChange={(e) => setFilter(col.key, e.target.value || undefined)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm min-w-[120px]"
                  >
                    <option value="">All</option>
                    {col.filterOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-emerald-50 text-emerald-800">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="p-2 text-left font-medium whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row) => (
              <tr key={row[idKey]} className="border-t border-gray-100 hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.key} className="p-2">
                    {col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hidden table for print (excludes action-only columns) */}
      <table id="data-table-print" className="hidden">
        <thead>
          <tr>
            {exportColumns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row) => (
            <tr key={row[idKey]}>
              {exportColumns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>
            {start + 1}-{Math.min(start + pageSize, filteredData.length)} of {filteredData.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-2 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-2 text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-2 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
