import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Plus, Trash2, Edit2, Save, X, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "../ui/ConfirmDialog";
import DataTable from "../ui/DataTable";

const CATEGORY_OPTIONS = ["Machinery", "Equipment", "Vehicle", "Furniture", "IT & Electronics", "Other"];
const CONDITION_OPTIONS = ["Good", "Fair", "Poor", "Under Maintenance"];

export default function ManagerialStockManager() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    unit: "Nos",
    condition: "",
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: "" });

  const fetchItems = async () => {
    try {
      const res = await api.get("/managerial-stock");
      setItems(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load managerial stock");
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const normalizeText = (text) => (text ? text.toLowerCase().trim().replace(/\s+/g, " ") : "");

  const checkDuplicate = async (name, excludeId = null) => {
    if (!name || name.trim().length < 2) return null;
    setCheckingDuplicate(true);
    try {
      const normalized = normalizeText(name);
      const existing = items.find(
        (i) =>
          (excludeId && i._id === excludeId) ||
          normalizeText(i.name) === normalized ||
          normalizeText(i.name).includes(normalized)
      );
      return existing ? existing.name : null;
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const getFieldError = (name, value) => {
    switch (name) {
      case "name":
        if (!value.trim()) return "Item name is required";
        if (value.trim().length < 2) return "Item name must be at least 2 characters";
        if (value.trim().length > 80) return "Item name must not exceed 80 characters";
        return null;
      case "category":
        if (!value.trim()) return "Category is required";
        return null;
      case "unit":
        if (!value.trim()) return "Unit is required";
        if (value.trim().length > 20) return "Unit must not exceed 20 characters";
        return null;
      case "condition":
        if (value.trim() && !CONDITION_OPTIONS.includes(value.trim())) return "Select a valid condition";
        return null;
      case "description":
        if (value.trim().length > 200) return "Description must not exceed 200 characters";
        return null;
      default:
        return null;
    }
  };

  const validateField = async (name, value) => {
    let msg = getFieldError(name, value);
    if (name === "name" && !msg) {
      const dup = await checkDuplicate(value, editingId);
      if (dup) msg = `Similar item exists: "${dup}"`;
    }
    setErrors((prev) => (msg ? { ...prev, [name]: msg } : { ...prev, [name]: undefined }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const validateAll = async () => {
    setTouched({ name: true, category: true, unit: true, condition: true, description: true });
    const newErrors = {};
    ["name", "category", "unit", "condition", "description"].forEach((name) => {
      const msg = getFieldError(name, formData[name]);
      if (msg) newErrors[name] = msg;
    });
    if (!newErrors.name && formData.name.trim()) {
      const dup = await checkDuplicate(formData.name, editingId);
      if (dup) newErrors.name = `Similar item exists: "${dup}"`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name] || value.length > 0) validateField(name, value);
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    validateField(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isValid = await validateAll();
    if (!isValid) {
      toast.error("Please fill all required fields correctly.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        unit: formData.unit.trim() || "Nos",
        condition: formData.condition.trim() || "",
        description: formData.description.trim() || "",
      };
      if (editingId) {
        await api.put(`/managerial-stock/${editingId}`, payload);
        toast.success("Item updated successfully");
      } else {
        await api.post("/managerial-stock", payload);
        toast.success("Item added successfully");
      }
      setFormData({ name: "", category: "", unit: "Nos", condition: "", description: "" });
      setEditingId(null);
      setErrors({});
      setTouched({});
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save item");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id, name) => setConfirmDelete({ open: true, id, name });

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.id) return;
    try {
      await api.delete(`/managerial-stock/${confirmDelete.id}`);
      toast.success("Item deleted successfully");
      setConfirmDelete({ open: false, id: null, name: "" });
      fetchItems();
    } catch (err) {
      toast.error("Failed to delete item");
    }
  };

  const handleEdit = (row) => {
    setEditingId(row._id);
    setFormData({
      name: row.name || "",
      category: row.category || "",
      unit: row.unit || "Nos",
      condition: row.condition || "",
      description: row.description || "",
    });
    setErrors({});
    setTouched({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: "", category: "", unit: "Nos", condition: "", description: "" });
    setErrors({});
    setTouched({});
  };

  const tableColumns = [
    { key: "name", label: "Name", filterOptions: items.length ? [...new Set(items.map((i) => i.name))] : [] },
    { key: "category", label: "Category", filterOptions: CATEGORY_OPTIONS },
    { key: "unit", label: "Unit", filterOptions: items.length ? [...new Set(items.map((i) => i.unit))] : [] },
    { key: "condition", label: "Condition", filterOptions: CONDITION_OPTIONS },
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
          <label className="block text-xs text-gray-600 mb-1">Item Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={80}
            placeholder="e.g. Rice Mill Machine"
            className={`border p-2 rounded text-sm w-full ${errors.name && touched.name ? "border-red-500 bg-red-50" : "border-gray-300"}`}
          />
          {errors.name && touched.name && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.name}
              {formData.name && formData.name.length > 70 && <span className="text-red-400">({formData.name.length}/80)</span>}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Category *</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`border p-2 rounded text-sm w-full ${errors.category && touched.category ? "border-red-500 bg-red-50" : "border-gray-300"}`}
          >
            <option value="">Select</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errors.category && touched.category && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.category}</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Unit *</label>
          <input
            type="text"
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={20}
            placeholder="Nos, etc."
            className={`border p-2 rounded text-sm w-full ${errors.unit && touched.unit ? "border-red-500 bg-red-50" : "border-gray-300"}`}
          />
          {errors.unit && touched.unit && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.unit}</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Condition</label>
          <select
            name="condition"
            value={formData.condition}
            onChange={handleChange}
            onBlur={handleBlur}
            className="border p-2 rounded text-sm w-full border-gray-300"
          >
            <option value="">—</option>
            {CONDITION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div className="col-span-4">
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
              <Plus size={16} /> {loading ? "Adding..." : "Add Item"}
            </button>
          )}
        </div>
      </form>

      <DataTable
        title="Managerial Stock"
        columns={tableColumns}
        data={items}
        idKey="_id"
        searchPlaceholder="Search items..."
        emptyMessage="No managerial stock items found. Quantity is managed via Gate Pass Inward."
      />

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: "" })}
        onConfirm={handleDeleteConfirm}
        title="Delete Item"
        message={`Are you sure you want to delete "${confirmDelete.name}"?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
