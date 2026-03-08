import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Plus, Trash2, Edit2, Save, X, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "../ui/ConfirmDialog";
import DataTable from "../ui/DataTable";
import AddOptionModal from "../ui/AddOptionModal";
import { sanitizeName, toTitleCase } from "../../utils/inputUtils";

const CONVERSION_UNIT_OPTIONS = ["Bag", "Ton"];
const DEFAULT_CONVERSION = { Bag: 65, Ton: 1000 };

export default function ProductManager({ tableOnly = false, editInModal = false }) {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    nameSelect: "",
    nameOther: "",
    brandSelect: "",
    brandOther: "",
    conversionFactors: { ...DEFAULT_CONVERSION },
    pricePerBag: "",
    pricePerTon: "",
    pricePerKg: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: "" });
  const [expandedBrands, setExpandedBrands] = useState(() => new Set());
  const [deleteType, setDeleteType] = useState("product");
  const [deleteValue, setDeleteValue] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [nameSuggestion, setNameSuggestion] = useState("");
  const [brandSuggestion, setBrandSuggestion] = useState("");
  const [purchaseItemOptions, setPurchaseItemOptions] = useState([]);
  const [purchaseCategoryOptions, setPurchaseCategoryOptions] = useState([]);
  const [transporterOptions, setTransporterOptions] = useState([]);
  const [settingsBrandOptions, setSettingsBrandOptions] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await api.get("/product-types");
      setProducts(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load product types");
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings");
      const s = res.data?.data || {};
      setPurchaseItemOptions(Array.isArray(s.purchaseItemOptions) ? s.purchaseItemOptions : []);
      setPurchaseCategoryOptions(
        Array.isArray(s.purchaseCategoryOptions) ? s.purchaseCategoryOptions : []
      );
      setTransporterOptions(Array.isArray(s.transporterOptions) ? s.transporterOptions : []);
      setSettingsBrandOptions(Array.isArray(s.brandOptions) ? s.brandOptions : []);
    } catch {
      toast.error("Failed to load purchase dropdowns");
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSettings();
  }, []);

  const productNameOptions = Array.from(
    new Set((products || []).map((p) => p.name).filter(Boolean))
  ).sort();
  const brandOptions = Array.from(
    new Set((products || []).map((p) => p.brand).filter(Boolean))
  ).sort();
  const allBrandOptions = Array.from(
    new Set([...(brandOptions || []), ...(settingsBrandOptions || [])].filter(Boolean))
  ).sort();
  const OTHER_OPTION = "__OTHER__";
  const isOtherName = formData.nameSelect === OTHER_OPTION;
  const currentProductName = isOtherName
    ? formData.nameOther
    : formData.nameSelect;
  const isOtherBrand = formData.brandSelect === OTHER_OPTION;
  const currentBrand = isOtherBrand ? formData.brandOther : formData.brandSelect;

  const levenshtein = (a, b) => {
    const s = a || "";
    const t = b || "";
    const dp = Array.from({ length: s.length + 1 }, () => Array(t.length + 1).fill(0));
    for (let i = 0; i <= s.length; i++) dp[i][0] = i;
    for (let j = 0; j <= t.length; j++) dp[0][j] = j;
    for (let i = 1; i <= s.length; i++) {
      for (let j = 1; j <= t.length; j++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[s.length][t.length];
  };

  const findSuggestion = (value, options) => {
    const q = normalizeText(value);
    if (!q || q.length < 3) return "";
    let best = "";
    let bestScore = Number.POSITIVE_INFINITY;
    for (const opt of options) {
      const norm = normalizeText(opt);
      if (!norm) continue;
      const score = levenshtein(q, norm);
      if (score < bestScore) {
        bestScore = score;
        best = opt;
      }
    }
    return bestScore <= 2 ? best : "";
  };

  const normalizeText = (text) => (text ? text.toLowerCase().trim().replace(/\s+/g, " ") : "");

  const checkDuplicate = async (name, brand, excludeId = null) => {
    if (!name || name.trim().length < 2) return null;
    setCheckingDuplicate(true);
    try {
      const normalized = normalizeText(name);
      const brandNorm = normalizeText(brand || "");
      const existing = products.find(
        (p) =>
          (excludeId && p._id === excludeId)
            ? false
            : normalizeText(p.name) === normalized &&
              normalizeText(p.brand || "") === brandNorm
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
        if (/\d/.test(value.trim())) return "Product name cannot contain numbers";
        if (/[^a-zA-Z\s]/.test(value.trim())) return "Product name cannot contain special characters";
        if (value.trim().length < 2) return "Product name must be at least 2 characters";
        if (value.trim().length > 50) return "Product name must not exceed 50 characters";
        return null;
      case "brand":
        if (!value.trim()) return "Brand is required";
        if (value.trim().length > 80) return "Brand must not exceed 80 characters";
        return null;
      case "pricePerKg":
        if (!value || String(value).trim() === "") return "Price per KG is required";
        return null;
      case "pricePerBag":
        if (!value || String(value).trim() === "") return "Price per Bag is required";
        return null;
      case "pricePerTon":
        if (!value || String(value).trim() === "") return "Price per Ton is required";
        return null;
      default:
        return null;
    }
  };

  const validateField = async (name, value) => {
    let msg = getFieldError(name, value);
    if (name === "name" && value && value.trim() && !msg && !isOtherName) {
      const dup = await checkDuplicate(value, currentBrand, editingId);
      if (dup) msg = `Similar product exists: "${dup}"`;
    }
    setErrors((prev) => (msg ? { ...prev, [name]: msg } : { ...prev, [name]: undefined }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const validateAll = async () => {
    setTouched({ name: true, brand: true, pricePerKg: true, pricePerBag: true, pricePerTon: true });
    const newErrors = {};
    ["name", "brand", "pricePerKg", "pricePerBag", "pricePerTon"].forEach((name) => {
      const val =
        name === "name"
          ? currentProductName
          : name === "brand"
          ? currentBrand
          : formData[name];
      const msg = getFieldError(name, val);
      if (msg) newErrors[name] = msg;
    });
    if (!newErrors.name && currentProductName.trim() && !isOtherName) {
      const dup = await checkDuplicate(currentProductName, currentBrand, editingId);
      if (dup) newErrors.name = `Similar product exists: "${dup}"`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processed = value;
    if (name === "nameOther") processed = sanitizeName(value);
    if (name === "brandOther") processed = value.replace(/[^a-zA-Z0-9\s.,\-]/g, "");
    if (name === "pricePerKg" || name === "pricePerBag" || name === "pricePerTon") {
      processed = value.replace(/\D/g, "").slice(0, 9);
    }
    setFormData((prev) => ({ ...prev, [name]: processed }));
    if (name === "nameOther") {
      if (touched.name || processed.length > 0) validateField("name", processed);
      return;
    }
    if (name === "brandOther") {
      if (touched.brand || processed.length > 0) validateField("brand", processed);
      return;
    }
    if (touched[name] || processed.length > 0) validateField(name, processed);
  };

  const handlePriceKgChange = (value) => {
    const processed = value.replace(/\D/g, "").slice(0, 9);
    const kg = Number(processed || 0);
    const bagFactor = Number(formData.conversionFactors?.Bag || 65);
    const tonFactor = Number(formData.conversionFactors?.Ton || 1000);
    setFormData((prev) => ({
      ...prev,
      pricePerKg: processed,
      pricePerBag: bagFactor ? String(Math.round(kg * bagFactor)) : prev.pricePerBag,
      pricePerTon: tonFactor ? String(Math.round(kg * tonFactor)) : prev.pricePerTon,
    }));
    validateField("pricePerKg", processed);
  };

  const handleNameSelect = (value) => {
    setFormData((prev) => ({
      ...prev,
      nameSelect: value,
      nameOther: value === OTHER_OPTION ? prev.nameOther : "",
    }));
    const nextName = value === OTHER_OPTION ? formData.nameOther : value;
    validateField("name", nextName);
  };

  const handleBrandSelect = (value) => {
    setFormData((prev) => ({
      ...prev,
      brandSelect: value,
      brandOther: value === OTHER_OPTION ? prev.brandOther : "",
    }));
    const nextBrand = value === OTHER_OPTION ? formData.brandOther : value;
    validateField("brand", nextBrand);
  };

  const handleConversionChange = (unit, factor) => {
    const num = factor === "" ? "" : Number(factor);
    if (num !== "" && (isNaN(num) || num <= 0)) return;
    const kg = Number(formData.pricePerKg || 0);
    setFormData((prev) => ({
      ...prev,
      conversionFactors: { ...prev.conversionFactors, [unit]: num === "" ? (unit === "Bag" ? 65 : 1000) : num },
      pricePerBag:
        unit === "Bag" && kg
          ? String(Math.round(kg * Number(num || prev.conversionFactors?.Bag || 65)))
          : prev.pricePerBag,
      pricePerTon:
        unit === "Ton" && kg
          ? String(Math.round(kg * Number(num || prev.conversionFactors?.Ton || 1000)))
          : prev.pricePerTon,
    }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (name === "nameOther" && value.trim()) {
      const titled = toTitleCase(value);
      setFormData((prev) => ({ ...prev, nameOther: titled }));
      validateField("name", titled);
    } else if (name === "brandOther" && value.trim()) {
      const titled = toTitleCase(value);
      setFormData((prev) => ({ ...prev, brandOther: titled }));
      validateField("brand", titled);
    } else {
      validateField(name, value);
    }
  };

  const saveProduct = async (skipConfirm = false) => {
    const isValid = await validateAll();
    if (!isValid) {
      toast.error("Please fill all required fields correctly.");
      return;
    }
    // no confirmation for new names/brands
    setLoading(true);
    try {
      const factors = { ...DEFAULT_CONVERSION, ...formData.conversionFactors };
      CONVERSION_UNIT_OPTIONS.forEach((u) => {
        if (typeof factors[u] !== "number" || factors[u] <= 0) factors[u] = u === "Bag" ? 65 : 1000;
      });
      if (!factors.Bag || !factors.Ton) {
        toast.error("Conversion factors for Bag and Ton are required.");
        setLoading(false);
        return;
      }
      const payload = {
        name: currentProductName.trim(),
        baseUnit: "KG",
        conversionFactors: factors,
        brand: currentBrand.trim(),
        pricePerBag: Number(formData.pricePerBag || 0),
        pricePerTon: Number(formData.pricePerTon || 0),
        pricePerKg: Number(formData.pricePerKg || 0),
      };
      if (editingId) {
        await api.put(`/product-types/${editingId}`, payload);
        toast.success("Product type updated successfully");
      } else {
        await api.post("/product-types", payload);
        toast.success("Product type added successfully");
      }
      setFormData({
        nameSelect: "",
        nameOther: "",
        brandSelect: "",
        brandOther: "",
        conversionFactors: { ...DEFAULT_CONVERSION },
        pricePerBag: "",
        pricePerTon: "",
        pricePerKg: "",
      });
      setEditingId(null);
      setEditModalOpen(false);
      setErrors({});
      setTouched({});
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save product type");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await saveProduct(false);
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


  const handleDeleteDropdown = async () => {
    if (!deleteValue) {
      toast.error("Select a value to delete.");
      return;
    }
    setDeleting(true);
    try {
      if (
        deleteType === "purchase_item" ||
        deleteType === "purchase_category" ||
        deleteType === "transporter"
      ) {
        const nextItems =
          deleteType === "purchase_item"
            ? purchaseItemOptions.filter((v) => v !== deleteValue)
            : purchaseItemOptions;
        const nextCategories =
          deleteType === "purchase_category"
            ? purchaseCategoryOptions.filter((v) => v !== deleteValue)
            : purchaseCategoryOptions;
        const nextTransporters =
          deleteType === "transporter"
            ? transporterOptions.filter((v) => v !== deleteValue)
            : transporterOptions;
        await api.put("/settings", {
          purchaseItemOptions: nextItems,
          purchaseCategoryOptions: nextCategories,
          transporterOptions: nextTransporters,
        });
        setPurchaseItemOptions(nextItems);
        setPurchaseCategoryOptions(nextCategories);
        setTransporterOptions(nextTransporters);
        toast.success("Deleted dropdown value.");
        setDeleteValue("");
      } else {
        const isProduct = deleteType === "product";
        const affected = products.filter((p) =>
          isProduct ? p.name === deleteValue : (p.brand || "") === deleteValue
        );
        if (affected.length === 0) {
          toast.error("No matching records to delete.");
          return;
        }
        await Promise.all(affected.map((p) => api.delete(`/product-types/${p._id}`)));
        toast.success(`Deleted ${affected.length} items.`);
        setDeleteValue("");
        fetchProducts();
      }
    } catch (err) {
      toast.error("Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (row) => {
    setEditingId(row._id);
    const factors = row.conversionFactors && typeof row.conversionFactors === "object" ? { ...DEFAULT_CONVERSION, ...row.conversionFactors } : { ...DEFAULT_CONVERSION };
    const existsInOptions = productNameOptions.includes(row.name || "");
    const brandExistsInOptions = allBrandOptions.includes(row.brand || "");
    setFormData({
      nameSelect: existsInOptions ? row.name || "" : OTHER_OPTION,
      nameOther: existsInOptions ? "" : row.name || "",
      brandSelect: brandExistsInOptions ? row.brand || "" : OTHER_OPTION,
      brandOther: brandExistsInOptions ? "" : row.brand || "",
      conversionFactors: factors,
      pricePerBag: row.pricePerBag ?? "",
      pricePerTon: row.pricePerTon ?? "",
      pricePerKg: row.pricePerKg ?? "",
    });
    setErrors({});
    setTouched({});
    if (tableOnly && editInModal) setEditModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      nameSelect: "",
      nameOther: "",
      brandSelect: "",
      brandOther: "",
      conversionFactors: { ...DEFAULT_CONVERSION },
      pricePerBag: "",
      pricePerTon: "",
      pricePerKg: "",
    });
    setErrors({});
    setTouched({});
    setEditModalOpen(false);
  };

  const brandGroups = React.useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      const brand = (p.brand || "").trim() || "Unbranded";
      if (!map.has(brand)) map.set(brand, []);
      map.get(brand).push(p);
    });
    return Array.from(map.entries())
      .map(([brand, items]) => ({
        brand,
        items: items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
      }))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  }, [products]);

  const brandRows = React.useMemo(
    () =>
      brandGroups.map((group) => ({
        brand: group.brand,
        productsText: group.items.map((i) => i.name).join(", "),
        count: group.items.length,
        items: group.items,
      })),
    [brandGroups]
  );

  const exportColumns = [
    { key: "brand", label: "Brand / Trademark" },
    { key: "product", label: "Product" },
    { key: "pricePerKg", label: "Price/KG (PKR)" },
    { key: "pricePerBag", label: "Price/Bag (PKR)" },
    { key: "pricePerTon", label: "Price/Ton (PKR)" },
  ];

  const exportData = (filteredGroups) =>
    (filteredGroups || []).flatMap((group) =>
      (group.items || []).map((item) => ({
        rowId: `${group.brand}-${item._id}`,
        brand: group.brand,
        product: item.name,
        pricePerKg: Number(item.pricePerKg || 0).toFixed(0),
        pricePerBag: Number(item.pricePerBag || 0).toFixed(0),
        pricePerTon: Number(item.pricePerTon || 0).toFixed(0),
      }))
    );

  return (
    <div className="space-y-4">
      {!tableOnly && (
      <form onSubmit={handleSubmit} className="grid grid-cols-6 gap-4 bg-emerald-50 p-4 rounded-lg">
        <div className="col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Brand / Trademark *</label>
          {!isOtherBrand ? (
            <select
              name="brandSelect"
              value={formData.brandSelect}
              onChange={(e) => handleBrandSelect(e.target.value)}
              onBlur={() =>
                validateField(
                  "brand",
                  isOtherBrand ? formData.brandOther : formData.brandSelect
                )
              }
              className={`border p-2 rounded text-sm w-full ${errors.brand && touched.brand ? "border-red-500 bg-red-50" : "border-gray-300"}`}
            >
              <option value="">Select brand</option>
              {allBrandOptions.map((b, idx) => (
                <option key={`${b}-${idx}`} value={b}>
                  {b}
                </option>
              ))}
              <option value={OTHER_OPTION}>Other</option>
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="brandOther"
                value={formData.brandOther}
                onChange={(e) => {
                  handleChange(e);
                  const suggestion = findSuggestion(e.target.value, allBrandOptions);
                  setBrandSuggestion(suggestion);
                }}
                onBlur={handleBlur}
                maxLength={80}
                placeholder="Enter new brand"
                className={`border p-2 rounded text-sm w-full ${errors.brand && touched.brand ? "border-red-500 bg-red-50" : "border-gray-300"}`}
              />
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, brandSelect: "", brandOther: "" }))}
                className="px-2 py-2 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                List
              </button>
            </div>
          )}
          {errors.brand && touched.brand && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.brand}
            </p>
          )}
          {isOtherBrand && brandSuggestion && (
            <button
              type="button"
              onClick={() => {
                handleBrandSelect(brandSuggestion);
                setBrandSuggestion("");
              }}
              className="mt-2 text-xs text-emerald-700 hover:underline"
            >
              Did you mean "{brandSuggestion}"?
            </button>
          )}
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Product Name *</label>
          {!isOtherName ? (
            <select
              name="nameSelect"
              value={formData.nameSelect}
              onChange={(e) => handleNameSelect(e.target.value)}
              onBlur={() => validateField("name", formData.nameSelect)}
              className={`border p-2 rounded text-sm w-full ${errors.name && touched.name ? "border-red-500 bg-red-50" : "border-gray-300"}`}
            >
              <option value="">Select product</option>
              {productNameOptions.map((p, idx) => (
                <option key={`${p}-${idx}`} value={p}>
                  {p}
                </option>
              ))}
              <option value={OTHER_OPTION}>Other</option>
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="nameOther"
                value={formData.nameOther}
                onChange={(e) => {
                  handleChange(e);
                  const suggestion = findSuggestion(e.target.value, productNameOptions);
                  setNameSuggestion(suggestion);
                }}
                onBlur={handleBlur}
                maxLength={50}
                placeholder="Enter new product name"
                className={`border p-2 rounded text-sm w-full ${errors.name && touched.name ? "border-red-500 bg-red-50" : "border-gray-300"}`}
              />
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, nameSelect: "", nameOther: "" }))}
                className="px-2 py-2 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                List
              </button>
            </div>
          )}
          {errors.name && touched.name && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.name}
            </p>
          )}
          {isOtherName && nameSuggestion && (
            <button
              type="button"
              onClick={() => {
                handleNameSelect(nameSuggestion);
                setNameSuggestion("");
              }}
              className="mt-2 text-xs text-emerald-700 hover:underline"
            >
              Did you mean "{nameSuggestion}"?
            </button>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Base Unit</label>
          <input type="text" value="KG" readOnly className="border p-2 rounded text-sm w-full bg-gray-100 text-gray-600" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Pricing per KG (PKR)</label>
          <input
            type="number"
            name="pricePerKg"
            min="0"
            step="1"
            value={formData.pricePerKg}
            onChange={(e) => handlePriceKgChange(e.target.value)}
            onBlur={handleBlur}
            placeholder="Required"
            className={`border p-2 rounded text-sm w-full ${
              errors.pricePerKg && touched.pricePerKg
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Pricing per Bag (PKR)</label>
          <input
            type="number"
            name="pricePerBag"
            min="0"
            step="1"
            value={formData.pricePerBag}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Required"
            className={`border p-2 rounded text-sm w-full ${
              errors.pricePerBag && touched.pricePerBag
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Pricing per Ton (PKR)</label>
          <input
            type="number"
            name="pricePerTon"
            min="0"
            step="1"
            value={formData.pricePerTon}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Required"
            className={`border p-2 rounded text-sm w-full ${
              errors.pricePerTon && touched.pricePerTon
                ? "border-red-500 bg-red-50"
                : "border-gray-300"
            }`}
          />
        </div>
        <div className="col-span-6">
          <label className="block text-xs text-gray-600 mb-1">Conversion Factor (1 unit = ? KG) - editable</label>
          <div className="flex flex-wrap gap-4 items-center">
            {CONVERSION_UNIT_OPTIONS.map((unit) => (
              <div key={unit} className="flex items-center gap-2">
                <span className="text-sm whitespace-nowrap">1 {unit} =</span>
                <input
                  type="number"
                  min={0.0001}
                  step="any"
                  value={formData.conversionFactors?.[unit] ?? (unit === "Bag" ? 65 : 1000)}
                  onChange={(e) => handleConversionChange(unit, e.target.value)}
                  className="border rounded px-2 py-1 w-20 text-sm"
                />
                <span className="text-sm">KG</span>
              </div>
            ))}
          </div>
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
              <Plus size={16} /> {loading ? "Adding..." : "Add Product"}
            </button>
          )}
        </div>
      </form>
      )}

      {tableOnly && editInModal && (
        <AddOptionModal
          open={editModalOpen}
          title="Edit Brand Product"
          subtitle="Only pricing can be updated here."
          onClose={cancelEdit}
          onSubmit={() => saveProduct(false)}
          submitLabel="Save Changes"
          loading={loading || checkingDuplicate}
          maxWidthClass="max-w-2xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Brand / Trademark *</label>
              <input
                type="text"
                value={isOtherBrand ? formData.brandOther : formData.brandSelect}
                readOnly
                className="border p-2 rounded text-sm w-full bg-gray-100 text-gray-700 border-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Product Name *</label>
              <input
                type="text"
                value={isOtherName ? formData.nameOther : formData.nameSelect}
                readOnly
                className="border p-2 rounded text-sm w-full bg-gray-100 text-gray-700 border-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Pricing per KG (PKR)</label>
              <input type="number" name="pricePerKg" value={formData.pricePerKg} onChange={(e) => handlePriceKgChange(e.target.value)} className="border p-2 rounded text-sm w-full border-gray-300" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Pricing per Bag (PKR)</label>
              <input type="number" name="pricePerBag" value={formData.pricePerBag} onChange={handleChange} className="border p-2 rounded text-sm w-full border-gray-300" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Pricing per Ton (PKR)</label>
              <input type="number" name="pricePerTon" value={formData.pricePerTon} onChange={handleChange} className="border p-2 rounded text-sm w-full border-gray-300" />
            </div>
          </div>
        </AddOptionModal>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="text-sm font-semibold text-emerald-800 mb-3">
          Production Stock (By Brand)
        </div>
        <DataTable
          title="Production Stock (By Brand)"
          data={brandRows}
          idKey="brand"
          searchPlaceholder="Search brand or product..."
          emptyMessage="No product types found."
          exportColumns={exportColumns}
          exportData={exportData}
          deleteAll={{
            description: "This will permanently delete ALL products (product types) from the database.",
            onConfirm: async (adminPin) => {
              const res = await api.post("/admin/purge", { adminPin, key: "productTypes" });
              const deleted = res?.data?.data?.deletedCount ?? 0;
              toast.success(`Deleted ${deleted} products`);
              setExpandedBrands(new Set());
              fetchProducts();
            },
          }}
          columns={[
            {
              key: "brand",
              label: "Brand / Trademark",
              filterOptions: brandGroups.map((g) => g.brand),
            },
            {
              key: "productsText",
              label: "Products",
              render: (_value, row) => {
                const isOpen = expandedBrands.has(row.brand);
                return (
                  <div className="space-y-2">
                    <div className="text-gray-600">{row.productsText || "-"}</div>
                    {isOpen && (
                      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                        <table className="min-w-[600px] w-full text-xs">
                          <thead className="bg-gray-100 text-gray-700">
                            <tr>
                              <th className="p-2 text-left">Product</th>
                              <th className="p-2 text-right">Price/KG</th>
                              <th className="p-2 text-right">Price/Bag</th>
                              <th className="p-2 text-right">Price/Ton</th>
                              <th className="p-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.items.map((item) => (
                              <tr key={item._id} className="border-t">
                                <td className="p-2">{item.name}</td>
                                <td className="p-2 text-right">
                                  {Number(item.pricePerKg || 0).toFixed(0)}
                                </td>
                                <td className="p-2 text-right">
                                  {Number(item.pricePerBag || 0).toFixed(0)}
                                </td>
                                <td className="p-2 text-right">
                                  {Number(item.pricePerTon || 0).toFixed(0)}
                                </td>
                                <td className="p-2 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEdit(item)}
                                      className="text-blue-600 hover:text-blue-800 p-1"
                                      title="Edit"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClick(item._id, item.name)}
                                      className="text-red-600 hover:text-red-800 p-1"
                                      title="Delete"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {row.items.length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-3 text-center text-gray-400">
                                  No products for this brand.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              },
            },
            {
              key: "count",
              label: "Count",
              render: (value) => <div className="text-right">{value}</div>,
            },
            {
              key: "actions",
              label: "Actions",
              skipExport: true,
              render: (_value, row) => {
                const isOpen = expandedBrands.has(row.brand);
                return (
                  <div className="text-right">
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={() =>
                        setExpandedBrands((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.brand)) next.delete(row.brand);
                          else next.add(row.brand);
                          return next;
                        })
                      }
                    >
                      {isOpen ? "Hide" : "View"}
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: "" })}
        onConfirm={handleDeleteConfirm}
        title="Delete Product Type"
        message={`Are you sure you want to delete "${confirmDelete.name}"?`}
        confirmLabel="Delete"
        variant="danger"
      />

      {!tableOnly && (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="text-sm font-semibold text-emerald-800 mb-2">
          Delete Dropdown Value
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Type</label>
            <select
              className="border p-2 rounded text-sm w-full"
              value={deleteType}
              onChange={(e) => {
                setDeleteType(e.target.value);
                setDeleteValue("");
              }}
            >
              <option value="product">Product Name</option>
              <option value="purchase_item">Purchase Item</option>
              <option value="purchase_category">Purchase Category</option>
              <option value="transporter">Transporter</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Value</label>
            <select
              className="border p-2 rounded text-sm w-full"
              value={deleteValue}
              onChange={(e) => setDeleteValue(e.target.value)}
            >
              <option value="">Select</option>
              {(deleteType === "product"
                ? productNameOptions
                : deleteType === "purchase_item"
                ? purchaseItemOptions
                : deleteType === "purchase_category"
                ? purchaseCategoryOptions
                : deleteType === "transporter"
                ? transporterOptions
                : []
              ).map((opt, idx) => (
                <option key={`${opt}-${idx}`} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              type="button"
              onClick={handleDeleteDropdown}
              disabled={deleting}
              className="w-full px-3 py-2 rounded bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}


