// src/components/MasterData/CompanyManager.jsx
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Plus, Trash2 } from "lucide-react";

export default function CompanyManager() {
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    type: "Supplier",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);

  // Fetch all companies
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

  // Add company
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/companies", formData);
      setFormData({
        name: "",
        type: "Supplier",
        contactPerson: "",
        phone: "",
        email: "",
        address: "",
      });
      fetchCompanies();
    } catch (err) {
      alert("Error adding company");
    } finally {
      setLoading(false);
    }
  };

  // Delete company
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

  return (
    <div className="space-y-4">
      {/* Add form */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-3 gap-4 bg-emerald-50 p-4 rounded-lg"
      >
        <input
          type="text"
          name="name"
          placeholder="Company Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="border p-2 rounded text-sm"
          required
        />
        <select
          name="type"
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          className="border p-2 rounded text-sm"
        >
          <option>Supplier</option>
          <option>Customer</option>
          <option>Both</option>
        </select>
        <input
          type="text"
          name="contactPerson"
          placeholder="Contact Person"
          value={formData.contactPerson}
          onChange={(e) =>
            setFormData({ ...formData, contactPerson: e.target.value })
          }
          className="border p-2 rounded text-sm"
        />
        <input
          type="text"
          name="phone"
          placeholder="Phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="border p-2 rounded text-sm"
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="border p-2 rounded text-sm"
        />
        <input
          type="text"
          name="address"
          placeholder="Address"
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          className="border p-2 rounded text-sm col-span-2"
        />
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded flex items-center justify-center"
        >
          {loading ? (
            "Adding..."
          ) : (
            <>
              <Plus size={16} className="mr-1" /> Add
            </>
          )}
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border text-sm rounded-lg">
          <thead className="bg-emerald-100 text-emerald-800">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Contact</th>
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
                <td className="p-2">
                  <button
                    onClick={() => handleDelete(c._id)}
                    className="text-red-500 hover:text-red-700"
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
