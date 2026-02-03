import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Plus, Trash2, Edit2, Save, X, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "../ui/ConfirmDialog";
import DataTable from "../ui/DataTable";
import { toTitleCase } from "../../utils/inputUtils";

const TYPE_OPTIONS = ["Operational", "Administrative", "Capital", "Payroll", "Utilities", "Maintenance", "Other"];

export default function ExpenseCategoryManager() {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: "" });

  const fetchCategories = async () => {
    try {
      const res = await api.get("/expense-categories");
      setCategories(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load expense categories");
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const normalizeText = (text) => (text ? text.toLowerCase().trim().replace(/\s+/g, " ") : "");

  const checkDuplicate = async (name, excludeId = null) => {
    if (!name || name.trim().length < 2) return null;
    setCheckingDuplicate(true);
    try {
      const normalized = normalizeText(name);
      const existing = categories.find(
        (c) => (excludeId && c._id === excludeId) ? false : normalizeText(c.name) === normalized
      );
      return existing ? existing.name : null;
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const getFieldError = (name, value) => {
    switch (name) {
      case "name":
        if (!value || !String(value).trim()) return "Category name is required";
        if (/\d/.test(String(value).trim())) return "Category name cannot contain numbers";
        if (/[^a-zA-Z\s]/.test(String(value).trim())) return "Category name cannot contain special characters";
        if (String(value).trim().length < 2) return "Category name must be at least 2 characters";
        if (String(value).trim().length > 50) return "Category name must not exceed 50 characters";
        return null;
      case "type":
        if (!value || !String(value).trim()) return "Category type is required for financial reporting";
        if (!TYPE_OPTIONS.includes(String(value).trim())) return "Select a valid type";
        return null;
      case "description":
        if (String(value).trim().length > 200) return "Description must not exceed 200 characters";
        return null;
      default:
        return null;
    }
  };

  const validateField = async (name, value) => {
    let msg = getFieldError(name, value);
    if (name === "name" && value && String(value).trim() && !msg) {
      const dup = await checkDuplicate(value, editingId);
      if (dup) msg = `Similar category exists: "${dup}"`;
    }
    setErrors((prev) => (msg ? { ...prev, [name]: msg } : { ...prev, [name]: undefined }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const validateAll = async () => {
    setTouched({ name: true, type: true, description: true });
    const newErrors = {};
    ["name", "type", "description"].forEach((name) => {
      const msg = getFieldError(name, formData[name]);
      if (msg) newErrors[name] = msg;
    });
    if (!newErrors.name && formData.name && formData.name.trim()) {
      const dup = await checkDuplicate(formData.name, editingId);
      if (dup) newErrors.name = `Similar category exists: "${dup}"`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    let processed = value;
    if (name === "name") processed = value.replace(/[0-9]/g, "").replace(/[^a-zA-Z\s]/g, "");
    if (name === "description") processed = value.replace(/[^a-zA-Z0-9\s.,\-]/g, "");
    setFormData((prev) => ({ ...prev, [name]: processed }));
    if (touched[name] || processed.length > 0) await validateField(name, processed);
  };

  const handleBlur = async (e) => {
    const { name, value } = e.target;
    let val = value;
    if (name === "name" && val && val.trim()) {
      val = toTitleCase(val);
      setFormData((prev) => ({ ...prev, [name]: val }));
    }
    await validateField(name, val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isValid = await validateAll();
    if (!isValid) {
      toast.error("Please fill all required fields (Name and Type are required).");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type.trim(),
        description: formData.description.trim() || "",
      };
      if (editingId) {
        await api.put(`/expense-categories/${editingId}`, payload);
        toast.success("Expense category updated successfully");
      } else {
        await api.post("/expense-categories", payload);
        toast.success("Expense category added successfully");
      }
      setFormData({ name: "", type: "", description: "" });
      setEditingId(null);
      setErrors({});
      setTouched({});
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save category");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id, name) => setConfirmDelete({ open: true, id, name });

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.id) return;
    try {
      await api.delete(`/expense-categories/${confirmDelete.id}`);
      toast.success("Expense category deleted successfully");
      setConfirmDelete({ open: false, id: null, name: "" });
      fetchCategories();
    } catch (err) {
      toast.error("Failed to delete category");
    }
  };

  const handleEdit = (row) => {
    setEditingId(row._id);
    setFormData({
      name: row.name || "",
      type: row.type || "",
      description: row.description || "",
    });
    setErrors({});
    setTouched({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: "", type: "", description: "" });
    setErrors({});
    setTouched({});
  };

  const typesFromData = categories.length ? [...new Set(categories.map((c) => c.type).filter(Boolean))].sort() : [];
  const tableColumns = [
    { key: "name", label: "Name", filterOptions: categories.map((c) => c.name) },
    { key: "type", label: "Type", filterOptions: typesFromData.length ? typesFromData : TYPE_OPTIONS },
    { key: "description", label: "Description" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => handleEdit(row)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit">
            <Edit2 size={16} />
          </button>
          <button type="button" onClick={() => handleDeleteClick(row._id, row.name)} className="text-red-600 hover:text-red-800 p-1" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-4 bg-emerald-50 p-4 rounded-lg">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Category Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={50}
            placeholder="e.g. Raw Material"
            className={`border p-2 rounded text-sm w-full ${errors.name && touched.name ? "border-red-500 bg-red-50" : touched.name && formData.name ? "border-green-500 bg-green-50" : "border-gray-300"}`}
          />
          {errors.name && touched.name && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.name}
              {formData.name && formData.name.length > 45 && <span className="text-red-400">({formData.name.length}/50)</span>}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Type * (for financial/HR reports)</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`border p-2 rounded text-sm w-full ${errors.type && touched.type ? "border-red-500 bg-red-50" : "border-gray-300"}`}
          >
            <option value="">Select type</option>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errors.type && touched.type && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.type}</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Description</label>
          <input
            type="text"
            name="description"
            value={formData.description}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={200}
            placeholder="Optional"
            className={`border p-2 rounded text-sm w-full ${errors.description && touched.description ? "border-red-500 bg-red-50" : "border-gray-300"}`}
          />
          {errors.description && touched.description && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.description} ({formData.description?.length || 0}/200)
            </p>
          )}
        </div>
        <div className="col-span-4 flex justify-end gap-2">
          {editingId ? (
            <>
              <button type="button" onClick={cancelEdit} className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-2 rounded flex items-center gap-1 text-sm">
                <X size={16} /> Cancel
              </button>
              <button type="submit" disabled={loading || checkingDuplicate} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm disabled:opacity-50">
                <Save size={16} /> {loading ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button type="submit" disabled={loading || checkingDuplicate} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm disabled:opacity-50">
              <Plus size={16} /> {loading ? "Adding..." : "Add Category"}
            </button>
          )}
        </div>
      </form>

      <DataTable
        title="Expense Categories"
        columns={tableColumns}
        data={categories}
        idKey="_id"
        searchPlaceholder="Search categories..."
        emptyMessage="No expense categories found"
      />

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: "" })}
        onConfirm={handleDeleteConfirm}
        title="Delete Expense Category"
        message={`Are you sure you want to delete "${confirmDelete.name}"?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
