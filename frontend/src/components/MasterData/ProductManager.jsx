import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Plus, Trash2, Edit2, Save, X, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "../ui/ConfirmDialog";
import DataTable from "../ui/DataTable";

const PRODUCT_CATEGORY_OPTIONS = ["Finished", "By-Product", "Waste"];
const SALE_UNIT_OPTIONS = ["Bag", "Ton", "KG"];
const DEFAULT_CONVERSION = { KG: 1, Bag: 65, Ton: 1000 };

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    productCategory: "",
    allowableSaleUnits: ["KG"],
    conversionFactors: { ...DEFAULT_CONVERSION },
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: "" });

  const fetchProducts = async () => {
    try {
      const res = await api.get("/product-types");
      setProducts(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load product types");
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const normalizeText = (text) => (text ? text.toLowerCase().trim().replace(/\s+/g, " ") : "");

  const checkDuplicate = async (name, excludeId = null) => {
    if (!name || name.trim().length < 2) return null;
    setCheckingDuplicate(true);
    try {
      const normalized = normalizeText(name);
      const existing = products.find(
        (p) =>
          (excludeId && p._id === excludeId) ||
          normalizeText(p.name) === normalized ||
          normalizeText(p.name).includes(normalized)
      );
      return existing ? existing.name : null;
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const getFieldError = (name, value) => {
    switch (name) {
      case "name":
        if (!value.trim()) return "Product name is required";
        if (value.trim().length < 2) return "Product name must be at least 2 characters";
        if (value.trim().length > 50) return "Product name must not exceed 50 characters";
        return null;
      case "productCategory":
        if (!value.trim()) return "Product category is required";
        if (!PRODUCT_CATEGORY_OPTIONS.includes(value)) return "Select Finished, By-Product, or Waste";
        return null;
      case "allowableSaleUnits":
        if (!value || !Array.isArray(value) || value.length === 0) return "Select at least one sale unit";
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
    if (name === "name" && value && value.trim() && !msg) {
      const dup = await checkDuplicate(value, editingId);
      if (dup) msg = `Similar product exists: "${dup}"`;
    }
    setErrors((prev) => (msg ? { ...prev, [name]: msg } : { ...prev, [name]: undefined }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const validateAll = async () => {
    setTouched({ name: true, productCategory: true, allowableSaleUnits: true, description: true });
    const newErrors = {};
    ["name", "productCategory", "allowableSaleUnits", "description"].forEach((name) => {
      const val = name === "allowableSaleUnits" ? formData.allowableSaleUnits : formData[name];
      const msg = getFieldError(name, val);
      if (msg) newErrors[name] = msg;
    });
    if (!newErrors.name && formData.name.trim()) {
      const dup = await checkDuplicate(formData.name, editingId);
      if (dup) newErrors.name = `Similar product exists: "${dup}"`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name] || value.length > 0) validateField(name, value);
  };

  const handleSaleUnitToggle = (unit) => {
    setFormData((prev) => {
      const current = prev.allowableSaleUnits || [];
      const next = current.includes(unit) ? current.filter((u) => u !== unit) : [...current, unit];
      if (next.length === 0) return prev;
      return { ...prev, allowableSaleUnits: next };
    });
  };

  const handleConversionChange = (unit, factor) => {
    const num = factor === "" ? "" : Number(factor);
    if (num !== "" && (isNaN(num) || num <= 0)) return;
    setFormData((prev) => ({
      ...prev,
      conversionFactors: { ...prev.conversionFactors, [unit]: num === "" ? (unit === "KG" ? 1 : 0) : num },
    }));
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
      const factors = { ...DEFAULT_CONVERSION, ...formData.conversionFactors };
      SALE_UNIT_OPTIONS.forEach((u) => {
        if (typeof factors[u] !== "number" || factors[u] <= 0) factors[u] = u === "KG" ? 1 : u === "Bag" ? 65 : 1000;
      });
      const payload = {
        name: formData.name.trim(),
        productCategory: formData.productCategory.trim(),
        baseUnit: "KG",
        allowableSaleUnits: formData.allowableSaleUnits.length ? formData.allowableSaleUnits : ["KG"],
        conversionFactors: factors,
        description: formData.description.trim() || "",
      };
      if (editingId) {
        await api.put(`/product-types/${editingId}`, payload);
        toast.success("Product type updated successfully");
      } else {
        await api.post("/product-types", payload);
        toast.success("Product type added successfully");
      }
      setFormData({
        name: "",
        productCategory: "",
        allowableSaleUnits: ["KG"],
        conversionFactors: { ...DEFAULT_CONVERSION },
        description: "",
      });
      setEditingId(null);
      setErrors({});
      setTouched({});
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save product type");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id, name) => setConfirmDelete({ open: true, id, name });

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.id) return;
    try {
      await api.delete(`/product-types/${confirmDelete.id}`);
      toast.success("Product type deleted successfully");
      setConfirmDelete({ open: false, id: null, name: "" });
      fetchProducts();
    } catch (err) {
      toast.error("Failed to delete product type");
    }
  };

  const handleEdit = (row) => {
    setEditingId(row._id);
    const saleUnits = Array.isArray(row.allowableSaleUnits) && row.allowableSaleUnits.length ? row.allowableSaleUnits : (row.unit ? [row.unit] : ["KG"]);
    const factors = row.conversionFactors && typeof row.conversionFactors === "object" ? { ...DEFAULT_CONVERSION, ...row.conversionFactors } : { ...DEFAULT_CONVERSION };
    setFormData({
      name: row.name || "",
      productCategory: row.productCategory || row.category || "",
      allowableSaleUnits: saleUnits,
      conversionFactors: factors,
      description: row.description || "",
    });
    setErrors({});
    setTouched({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      name: "",
      productCategory: "",
      allowableSaleUnits: ["KG"],
      conversionFactors: { ...DEFAULT_CONVERSION },
      description: "",
    });
    setErrors({});
    setTouched({});
  };

  const tableColumns = [
    { key: "name", label: "Product Name", filterOptions: products.map((p) => p.name) },
    { key: "productCategory", label: "Product Category", filterOptions: PRODUCT_CATEGORY_OPTIONS, render: (val, row) => val || row.category || "—" },
    { key: "baseUnit", label: "Base Unit", render: (val) => val || "KG" },
    {
      key: "allowableSaleUnits",
      label: "Sale Units",
      render: (val, row) => (Array.isArray(val) ? val.join(", ") : row.unit ? String(row.unit) : "—"),
    },
    {
      key: "conversionFactors",
      label: "Conversion (to KG)",
      render: (val) => {
        if (!val || typeof val !== "object") return "—";
        const parts = [];
        if (val.Bag) parts.push(`1 Bag = ${val.Bag} KG`);
        if (val.Ton) parts.push(`1 Ton = ${val.Ton} KG`);
        if (val.KG) parts.push("1 KG = 1 KG");
        return parts.length ? parts.join("; ") : "—";
      },
    },
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
      <form onSubmit={handleSubmit} className="grid grid-cols-6 gap-4 bg-emerald-50 p-4 rounded-lg">
        <div className="col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Product Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={50}
            placeholder="e.g. Basmati Rice"
            className={`border p-2 rounded text-sm w-full ${errors.name && touched.name ? "border-red-500 bg-red-50" : "border-gray-300"}`}
          />
          {errors.name && touched.name && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.name}
              {formData.name && formData.name.length > 45 && <span className="text-red-400">({formData.name.length}/50)</span>}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Product Category *</label>
          <select
            name="productCategory"
            value={formData.productCategory}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`border p-2 rounded text-sm w-full ${errors.productCategory && touched.productCategory ? "border-red-500 bg-red-50" : "border-gray-300"}`}
          >
            <option value="">Select</option>
            {PRODUCT_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errors.productCategory && touched.productCategory && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.productCategory}</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Base Unit</label>
          <input type="text" value="KG" readOnly className="border p-2 rounded text-sm w-full bg-gray-100 text-gray-600" />
        </div>
        <div className="col-span-6">
          <label className="block text-xs text-gray-600 mb-1">Allowable Sale Units * (Bag, Ton, KG)</label>
          <div className="flex gap-4 items-center">
            {SALE_UNIT_OPTIONS.map((unit) => (
              <label key={unit} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(formData.allowableSaleUnits || []).includes(unit)}
                  onChange={() => handleSaleUnitToggle(unit)}
                />
                <span className="text-sm">{unit}</span>
              </label>
            ))}
          </div>
          {errors.allowableSaleUnits && touched.allowableSaleUnits && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.allowableSaleUnits}</p>
          )}
        </div>
        <div className="col-span-6">
          <label className="block text-xs text-gray-600 mb-1">Conversion Factor (1 unit = ? KG) — editable</label>
          <div className="flex flex-wrap gap-4 items-center">
            {SALE_UNIT_OPTIONS.map((unit) => (
              <div key={unit} className="flex items-center gap-2">
                <span className="text-sm whitespace-nowrap">1 {unit} =</span>
                <input
                  type="number"
                  min={unit === "KG" ? 1 : 0.001}
                  step={unit === "KG" ? 1 : 0.5}
                  value={formData.conversionFactors?.[unit] ?? (unit === "KG" ? 1 : unit === "Bag" ? 65 : 1000)}
                  onChange={(e) => handleConversionChange(unit, e.target.value)}
                  className="border rounded px-2 py-1 w-20 text-sm"
                />
                <span className="text-sm">KG</span>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-6">
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
        <div className="col-span-6 flex justify-end gap-2">
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
              <Plus size={16} /> {loading ? "Adding..." : "Add Product Type"}
            </button>
          )}
        </div>
      </form>

      <DataTable
        title="Production Stock"
        columns={tableColumns}
        data={products}
        idKey="_id"
        searchPlaceholder="Search products..."
        emptyMessage="No product types found"
      />

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: "" })}
        onConfirm={handleDeleteConfirm}
        title="Delete Product Type"
        message={`Are you sure you want to delete "${confirmDelete.name}"?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
