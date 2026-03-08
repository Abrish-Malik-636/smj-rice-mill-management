import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Plus, Trash2, Edit2, Save, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "../ui/ConfirmDialog";
import DataTable from "../ui/DataTable";
import AddOptionModal from "../ui/AddOptionModal";

export default function CompanyManager({ tableOnly = false, editInModal = false }) {
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
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
  const [editModalOpen, setEditModalOpen] = useState(false);

  const fetchCompanies = async () => {
    try {
      const res = await api.get("/companies");
      setCompanies(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load customers");
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
        return normalizeText(c.name) === normalized;
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
        if (!value.trim()) return "Customer name is required";
        if (/\d/.test(value.trim())) return "Customer name cannot contain numbers";
        if (/[^a-zA-Z\s]/.test(value.trim())) return "Customer name cannot contain special characters";
        if (value.trim().length < 2) return "Customer name must be at least 2 characters";
        if (value.trim().length > 100) return "Customer name must not exceed 100 characters";
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
        if (/[^a-zA-Z0-9\s.,\-]/.test(value.trim())) return "Address cannot contain special characters";
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
      if (dup) msg = `Customer with same name already exists: "${dup}"`;
    }
    setErrors((prev) => (msg ? { ...prev, [name]: msg } : { ...prev, [name]: undefined }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  // Validate ALL fields on submit and set all errors at once
  const validateAll = async () => {
    const allTouched = { name: true, phone: true, email: true, address: true };
    setTouched(allTouched);
    const newErrors = {};
    const fields = ["name", "phone", "email", "address"];
    for (const name of fields) {
      const msg = getFieldError(name, formData[name]);
      if (msg) newErrors[name] = msg;
    }
    if (!newErrors.name && formData.name.trim()) {
      const dup = await checkDuplicate(formData.name, editingId);
      if (dup) newErrors.name = `Similar customer exists: "${dup}"`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    let processed = value;
    if (name === "phone") processed = formatPhone(value);
    if (name === "name") processed = value.replace(/[0-9]/g, "").replace(/[^a-zA-Z\s]/g, "");
    if (name === "address") processed = value.replace(/[^a-zA-Z0-9\s.,\-]/g, "");
    setFormData((prev) => ({ ...prev, [name]: processed }));
    if (touched[name] || value.length > 0) await validateField(name, processed);
  };

  const toTitleCase = (str) => str && typeof str === "string" ? str.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : str;

  const handleBlur = async (e) => {
    const { name, value } = e.target;
    let val = name === "phone" ? formatPhone(value) : value;
    if (name === "name" && val && val.trim()) {
      val = toTitleCase(val);
      setFormData((prev) => ({ ...prev, [name]: val }));
    }
    await validateField(name, val);
  };

  const submitForm = async () => {
    const isValid = await validateAll();
    if (!isValid) {
      toast.error("Please fill all required fields correctly.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        address: formData.address.trim(),
      };
      if (editingId) {
        await api.put(`/companies/${editingId}`, payload);
        toast.success("Customer updated successfully");
      } else {
        await api.post("/companies", payload);
        toast.success("Customer added successfully");
      }
      setFormData({ name: "", phone: "", email: "", address: "" });
      setEditingId(null);
      setErrors({});
      setTouched({});
      fetchCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save customer");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitForm();
  };

  const handleDeleteClick = (id, name) => setConfirmDelete({ open: true, id, name });

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.id) return;
    try {
      await api.delete(`/companies/${confirmDelete.id}`);
      toast.success("Customer deleted successfully");
      setConfirmDelete({ open: false, id: null, name: "" });
      fetchCompanies();
    } catch (err) {
      toast.error("Failed to delete customer");
    }
  };

  const handleEdit = (row) => {
    setEditingId(row._id);
    setFormData({
      name: row.name || "",
      phone: row.phone || "",
      email: row.email || "",
      address: row.address || "",
    });
    setErrors({});
    setTouched({});
    if (tableOnly && editInModal) setEditModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: "", phone: "", email: "", address: "" });
    setErrors({});
    setTouched({});
    setEditModalOpen(false);
  };

  const tableColumns = [
    { key: "name", label: "Name", filterOptions: companies.length ? [...new Set(companies.map((c) => c.name))] : [] },
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
    { name: "name", label: "Customer Name *", span: 2, type: "text", maxLength: 100 },
    { name: "phone", label: "Phone (03XX-XXXXXXX) *", span: 1, type: "tel", maxLength: 12 },
    { name: "email", label: "Email *", span: 2, type: "email", maxLength: 100 },
    { name: "address", label: "Address *", span: 4, type: "text", maxLength: 200 },
  ];

  return (
    <div className="space-y-4">
      {!tableOnly && (
        <form onSubmit={handleSubmit} className="grid grid-cols-6 gap-4 bg-emerald-50 p-4 rounded-lg">
          {formFields.map((field) => (
            <div key={field.name} className={field.span === 2 ? "col-span-2" : field.span === 4 ? "col-span-4" : "col-span-1"}>
              <label className="block text-xs text-gray-600 mb-1">{field.label}</label>
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
                <Plus size={16} /> {loading ? "Adding..." : "Add Customer"}
              </button>
            )}
          </div>
        </form>
      )}

      <DataTable
        title="Customers"
        columns={tableColumns}
        data={companies}
        idKey="_id"
        searchPlaceholder="Search customers..."
        emptyMessage="No customers found"
        deleteAll={{
          description: "This will permanently delete ALL customers from the database.",
          onConfirm: async (adminPin) => {
            const res = await api.post("/admin/purge", { adminPin, key: "companies" });
            const deleted = res?.data?.data?.deletedCount ?? 0;
            toast.success(`Deleted ${deleted} customers`);
            fetchCompanies();
          },
        }}
      />

      {tableOnly && editInModal && (
        <AddOptionModal
          open={editModalOpen}
          title="Edit Customer"
          subtitle="Update customer details and save changes."
          onClose={cancelEdit}
          onSubmit={submitForm}
          submitLabel="Save Changes"
          loading={loading}
          maxWidthClass="max-w-2xl"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {formFields.map((field) => (
              <div key={`modal-${field.name}`} className={field.span === 4 ? "sm:col-span-2" : ""}>
                <label className="block text-xs text-gray-600 mb-1">{field.label}</label>
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={field.maxLength}
                  className={`border p-2 rounded text-sm w-full ${
                    errors[field.name] && touched[field.name]
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                />
                {errors[field.name] && touched[field.name] && (
                  <p className="text-xs text-red-500 mt-1">{errors[field.name]}</p>
                )}
              </div>
            ))}
          </div>
        </AddOptionModal>
      )}

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: "" })}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer"
        message={`Are you sure you want to delete "${confirmDelete.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
