import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";

export default function ExpenseCategoryManager() {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    description: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await api.get("/expense-categories");
      setCategories(res.data.data || []);
    } catch (err) {
      console.error("❌ Error loading categories:", err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Name is required.");

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/expense-categories/${editingId}`, formData);
      } else {
        await api.post("/expense-categories", formData);
      }
      setFormData({ name: "", type: "", description: "" });
      setEditingId(null);
      fetchCategories();
    } catch (err) {
      alert("Error saving category");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await api.delete(`/expense-categories/${id}`);
      fetchCategories();
    } catch (err) {
      alert("Error deleting");
    }
  };

  const handleEdit = (cat) => {
    setEditingId(cat._id);
    setFormData({
      name: cat.name,
      type: cat.type,
      description: cat.description,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: "", type: "", description: "" });
  };

  return (
    <div className="space-y-4">
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-4 gap-4 bg-emerald-50 p-4 rounded-lg"
      >
        <input
          type="text"
          placeholder="Category Name *"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="border p-2 rounded text-sm col-span-1"
          required
        />

        <input
          type="text"
          placeholder="Type (Operational, Admin...)"
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          className="border p-2 rounded text-sm col-span-1"
        />

        <input
          type="text"
          placeholder="Description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="border p-2 rounded text-sm col-span-2"
        />

        <div className="col-span-4 flex justify-end gap-2">
          {editingId ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-2 rounded flex items-center gap-1"
              >
                <X size={16} />
                Cancel
              </button>

              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center gap-1"
              >
                <Save size={16} />
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center gap-1"
            >
              <Plus size={16} />
              {loading ? "Adding..." : "Add Category"}
            </button>
          )}
        </div>
      </form>

      {/* Table */}
      <table className="w-full border text-sm rounded-lg">
        <thead className="bg-emerald-100 text-emerald-800">
          <tr>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Type</th>
            <th className="p-2 text-left">Description</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {categories.map((c) => (
            <tr key={c._id} className="border-t hover:bg-gray-50">
              <td className="p-2">{c.name}</td>
              <td className="p-2">{c.type}</td>
              <td className="p-2">{c.description}</td>

              <td className="p-2 flex gap-3 items-center">
                <button
                  onClick={() => handleEdit(c)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(c._id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}

          {categories.length === 0 && (
            <tr>
              <td colSpan="4" className="text-center text-gray-400 p-3">
                No categories found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
