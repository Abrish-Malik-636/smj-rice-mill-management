import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Plus, Trash2, Edit2, Save, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "../ui/ConfirmDialog";
import DataTable from "../ui/DataTable";

const TYPE_OPTIONS = ["Supplier", "Customer", "Transporter", "Both(Supplier & Customer)"];

export default function CompanyManager() {
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: "" });

  const fetchCompanies = async () => {
    try {
      const res = await api.get("/companies");
      setCompanies(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load parties");
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  };

  const normalizeText = (text) =>
    text ? text.toLowerCase().trim().replace(/\s+/g, " ") : "";

  const checkDuplicate = async (name, excludeId = null) => {
    if (!name || name.trim().length < 2) return null;
    setCheckingDuplicate(true);
    try {
      const normalized = normalizeText(name);
      const existing = companies.find((c) => {
        if (excludeId && c._id === excludeId) return false;
        return normalizeText(c.name) === normalized || normalizeText(c.name).includes(normalized) || normalized.includes(normalizeText(c.name));
      });
      return existing ? existing.name : null;
    } finally {
      setCheckingDuplicate(false);
    }
  };

  // Validate a single field and return error message or null
  const getFieldError = (name, value) => {
    switch (name) {
      case "name":
        if (!value.trim()) return "Party name is required";
        if (/\d/.test(value.trim())) return "Party name cannot contain numbers";
        if (value.trim().length < 2) return "Party name must be at least 2 characters";
        if (value.trim().length > 100) return "Party name must not exceed 100 characters";
        return null;
      case "type":
        if (!value.trim()) return "Type is required";
        if (!TYPE_OPTIONS.includes(value)) return "Select a valid type";
        return null;
      case "contactPerson":
        if (!value.trim()) return "Contact person is required";
        if (value.trim().length < 2) return "Contact person must be at least 2 characters";
        if (value.trim().length > 50) return "Contact person must not exceed 50 characters";
        if (!/^[a-zA-Z\s]+$/.test(value.trim())) return "Contact person can only contain letters and spaces";
        return null;
      case "phone": {
        const digits = value.replace(/\D/g, "");
        if (!digits) return "Phone number is required";
        if (digits.length !== 11) return "Phone number must be 11 digits (03XX-XXXXXXX)";
        if (!digits.startsWith("03")) return "Phone number must start with 03";
        return null;
      }
      case "email":
        if (!value.trim()) return "Email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Invalid email format";
        if (value.trim().length > 100) return "Email must not exceed 100 characters";
        return null;
      case "address":
        if (!value.trim()) return "Address is required";
        if (value.trim().length < 5) return "Address must be at least 5 characters";
        if (value.trim().length > 200) return "Address must not exceed 200 characters";
        return null;
      default:
        return null;
    }
  };

  const validateField = async (name, value) => {
    let msg = getFieldError(name, value);
    if (name === "name" && !msg) {
      const dup = await checkDuplicate(value, editingId);
      if (dup) msg = `Similar party exists: "${dup}"`;
    }
    setErrors((prev) => (msg ? { ...prev, [name]: msg } : { ...prev, [name]: undefined }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  // Validate ALL fields on submit and set all errors at once
  const validateAll = async () => {
    const allTouched = { name: true, type: true, contactPerson: true, phone: true, email: true, address: true };
    setTouched(allTouched);
    const newErrors = {};
    const fields = ["name", "type", "contactPerson", "phone", "email", "address"];
    for (const name of fields) {
      const msg = getFieldError(name, formData[name]);
      if (msg) newErrors[name] = msg;
    }
    if (!newErrors.name && formData.name.trim()) {
      const dup = await checkDuplicate(formData.name, editingId);
      if (dup) newErrors.name = `Similar party exists: "${dup}"`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    let processed = value;
    if (name === "phone") processed = formatPhone(value);
    if (name === "contactPerson") processed = value.replace(/[^a-zA-Z\s]/g, "");
    if (name === "name") processed = value.replace(/[0-9]/g, "");
    setFormData((prev) => ({ ...prev, [name]: processed }));
    if (touched[name] || value.length > 0) await validateField(name, processed);
  };

  const handleBlur = async (e) => {
    const { name, value } = e.target;
    await validateField(name, name === "phone" ? formatPhone(value) : value);
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
        type: formData.type.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        address: formData.address.trim(),
      };
      if (editingId) {
        await api.put(`/companies/${editingId}`, payload);
        toast.success("Party updated successfully");
      } else {
        await api.post("/companies", payload);
        toast.success("Party added successfully");
      }
      setFormData({ name: "", type: "", contactPerson: "", phone: "", email: "", address: "" });
      setEditingId(null);
      setErrors({});
      setTouched({});
      fetchCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save party");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id, name) => setConfirmDelete({ open: true, id, name });

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.id) return;
    try {
      await api.delete(`/companies/${confirmDelete.id}`);
      toast.success("Party deleted successfully");
      setConfirmDelete({ open: false, id: null, name: "" });
      fetchCompanies();
    } catch (err) {
      toast.error("Failed to delete party");
    }
  };

  const handleEdit = (row) => {
    setEditingId(row._id);
    setFormData({
      name: row.name || "",
      type: row.type || "",
      contactPerson: row.contactPerson || "",
      phone: row.phone || "",
      email: row.email || "",
      address: row.address || "",
    });
    setErrors({});
    setTouched({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: "", type: "", contactPerson: "", phone: "", email: "", address: "" });
    setErrors({});
    setTouched({});
  };

  const tableColumns = [
    { key: "name", label: "Name", filterOptions: companies.length ? [...new Set(companies.map((c) => c.name))] : [] },
    { key: "type", label: "Type", filterOptions: TYPE_OPTIONS },
    { key: "contactPerson", label: "Contact Person" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <div className="flex gap-2 items-center">
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

  const formFields = [
    { name: "name", label: "Party Name *", span: 2, type: "text", maxLength: 100 },
    { name: "type", label: "Type *", span: 1, type: "select", options: TYPE_OPTIONS },
    { name: "contactPerson", label: "Contact Person *", span: 1, type: "text", maxLength: 50 },
    { name: "phone", label: "Phone (03XX-XXXXXXX) *", span: 1, type: "tel", maxLength: 12 },
    { name: "email", label: "Email *", span: 2, type: "email", maxLength: 100 },
    { name: "address", label: "Address *", span: 4, type: "text", maxLength: 200 },
  ];

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="grid grid-cols-6 gap-4 bg-emerald-50 p-4 rounded-lg">
        {formFields.map((field) => (
          <div key={field.name} className={field.span === 2 ? "col-span-2" : field.span === 4 ? "col-span-4" : "col-span-1"}>
            <label className="block text-xs text-gray-600 mb-1">{field.label}</label>
            {field.type === "select" ? (
              <select
                name={field.name}
                value={formData[field.name]}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`border p-2 rounded text-sm w-full ${
                  errors[field.name] && touched[field.name] ? "border-red-500 bg-red-50" : touched[field.name] && formData[field.name] ? "border-green-500 bg-green-50" : "border-gray-300"
                }`}
              >
                <option value="">Select</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <input
                  type={field.type}
                  name={field.name}
                  placeholder={field.label}
                  value={formData[field.name]}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={field.maxLength}
                  className={`border p-2 rounded text-sm w-full pr-8 ${
                    errors[field.name] && touched[field.name] ? "border-red-500 bg-red-50" : touched[field.name] && formData[field.name] ? "border-green-500 bg-green-50" : "border-gray-300"
                  }`}
                />
                {touched[field.name] && !errors[field.name] && formData[field.name] && (
                  <CheckCircle2 className="absolute right-2 top-3 text-green-500" size={16} />
                )}
              </div>
            )}
            {errors[field.name] && touched[field.name] && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors[field.name]}
                {field.maxLength && (
                  <span className="text-red-400 ml-1">
                    ({formData[field.name]?.length || 0}/{field.maxLength})
                  </span>
                )}
              </p>
            )}
          </div>
        ))}
        <div className="col-span-6 flex justify-end gap-2 mt-2">
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
              <Plus size={16} /> {loading ? "Adding..." : "Add Party"}
            </button>
          )}
        </div>
      </form>

      <DataTable
        title="Parties"
        columns={tableColumns}
        data={companies}
        idKey="_id"
        searchPlaceholder="Search parties..."
        emptyMessage="No parties found"
      />

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: "" })}
        onConfirm={handleDeleteConfirm}
        title="Delete Party"
        message={`Are you sure you want to delete "${confirmDelete.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
