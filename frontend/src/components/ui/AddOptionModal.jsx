import React from "react";

export default function AddOptionModal({
  open,
  title = "Add New",
  subtitle = "",
  children,
  onClose,
  onSubmit,
  submitLabel = "Add",
  loading = false,
  maxWidthClass = "max-w-lg",
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className={`w-full ${maxWidthClass} rounded-xl bg-white shadow-xl border border-gray-200`}>
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="text-base font-semibold text-gray-900">{title}</div>
          {subtitle ? (
            <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
          ) : null}
        </div>
        <div className="p-4 space-y-3">{children}</div>
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
