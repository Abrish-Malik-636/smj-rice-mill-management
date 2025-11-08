import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Plus, Trash2, Edit2, Save, X, AlertCircle } from "lucide-react";

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
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCompanies = async () => {
    try {
      const res = await api.get("/companies");
      setCompanies(res.data.data || []);
    } catch (err) {
      console.error("❌ Error loading companies:", err);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // ✅ Validation logic
  const validate = () => {
    let newErrors = {};

    if (!formData.name.trim()) newErrors.name = "Company name is required";
    if (!formData.type.trim()) newErrors.type = "Type is required";
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = "Contact person is required";

    const phonePattern = /^03\d{2}-\d{7}$/;
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!phonePattern.test(formData.phone))
      newErrors.phone = "Phone must be in 03XX-XXXXXXX format";

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!emailPattern.test(formData.email))
      newErrors.email = "Invalid email format";

    if (!formData.address.trim()) newErrors.address = "Address is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ Handle submit (with validation)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return; // Stop if invalid

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/companies/${editingId}`, formData);
      } else {
        await api.post("/companies", formData);
      }
      setFormData({
        name: "",
        type: "",
        contactPerson: "",
        phone: "",
        email: "",
        address: "",
      });
      setEditingId(null);
      fetchCompanies();
    } catch (err) {
      alert("Error saving company");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this company?"))
      return;
    try {
      await api.delete(`/companies/${id}`);
      fetchCompanies();
    } catch (err) {
      alert("Failed to delete company");
    }
  };

  const handleEdit = (company) => {
    setEditingId(company._id);
    setFormData({
      name: company.name,
      type: company.type,
      contactPerson: company.contactPerson,
      phone: company.phone,
      email: company.email,
      address: company.address,
    });
    setErrors({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      name: "",
      type: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
    });
    setErrors({});
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-6 gap-4 bg-emerald-50 p-4 rounded-lg"
      >
        {[
          { name: "name", label: "Company Name", span: 2 },
          { name: "type", label: "Type (Supplier / Customer / Both)", span: 1 },
          { name: "contactPerson", label: "Contact Person", span: 1 },
          { name: "phone", label: "03XX-XXXXXXX", span: 1 },
          { name: "email", label: "Email", span: 2 },
          { name: "address", label: "Address", span: 4 },
        ].map((field) => (
          <div key={field.name} className={`col-span-${field.span}`}>
            <input
              type={field.name === "email" ? "email" : "text"}
              name={field.name}
              placeholder={field.label}
              value={formData[field.name]}
              onChange={(e) =>
                setFormData({ ...formData, [field.name]: e.target.value })
              }
              className={`border p-2 rounded text-sm w-full ${
                errors[field.name] ? "border-red-400" : ""
              }`}
            />
            {errors[field.name] && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors[field.name]}
              </p>
            )}
          </div>
        ))}

        <div className="col-span-6 flex justify-end gap-2 mt-2">
          {editingId ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-2 rounded flex items-center gap-1 text-sm"
              >
                <X size={16} /> Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm disabled:opacity-50"
                disabled={loading}
              >
                <Save size={16} /> {loading ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm disabled:opacity-50"
              disabled={loading}
            >
              <Plus size={16} /> {loading ? "Adding..." : "Add Company"}
            </button>
          )}
        </div>
      </form>

      {/* Table stays same */}
      <div className="overflow-x-auto">
        <table className="w-full border text-sm rounded-lg">
          <thead className="bg-emerald-100 text-emerald-800">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Contact Person</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Address</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c._id} className="border-t hover:bg-gray-50">
                <td className="p-2">{c.name}</td>
                <td className="p-2">{c.type}</td>
                <td className="p-2">{c.contactPerson}</td>
                <td className="p-2">{c.phone}</td>
                <td className="p-2">{c.email}</td>
                <td className="p-2">{c.address}</td>
                <td className="p-2 flex gap-3 items-center">
                  <button
                    onClick={() => handleEdit(c)}
                    className="text-blue-500 hover:text-blue-700"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(c._id)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center text-gray-400 p-3">
                  No companies found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
