import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Plus, Trash2, Edit2, Save, X, AlertCircle } from "lucide-react";

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    unit: "",
  });
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch all product types
  const fetchProducts = async () => {
    try {
      const res = await api.get("/product-types");
      setProducts(res.data.data || []);
    } catch (err) {
      console.error("❌ Error loading product types:", err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // ✅ Validation logic
  const validate = () => {
    let newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Product name is required";
    if (!formData.category.trim())
      newErrors.category = "Category is required (e.g., Rice, Paddy)";
    if (!formData.unit.trim())
      newErrors.unit = "Unit is required (e.g., kg, bags)";
    if (formData.description.trim().length < 3)
      newErrors.description = "Description must be at least 3 characters long";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/product-types/${editingId}`, formData);
      } else {
        await api.post("/product-types", formData);
      }
      setFormData({ name: "", category: "", description: "", unit: "" });
      setEditingId(null);
      setErrors({});
      fetchProducts();
    } catch (err) {
      alert("Error saving product type");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product type?"))
      return;
    try {
      await api.delete(`/product-types/${id}`);
      fetchProducts();
    } catch (err) {
      alert("Failed to delete product type");
    }
  };

  const handleEdit = (product) => {
    setEditingId(product._id);
    setFormData({
      name: product.name,
      category: product.category,
      description: product.description,
      unit: product.unit,
    });
    setErrors({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: "", category: "", description: "", unit: "" });
    setErrors({});
  };

  return (
    <div className="space-y-4">
      {/* Add/Edit form */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-4 gap-4 bg-emerald-50 p-4 rounded-lg"
      >
        {[
          { name: "name", label: "Product Name", span: 1 },
          { name: "category", label: "Category (e.g. Rice, Paddy)", span: 1 },
          { name: "unit", label: "Unit (e.g. kg, bags)", span: 1 },
          { name: "description", label: "Description", span: 1 },
        ].map((field) => (
          <div key={field.name} className={`col-span-${field.span}`}>
            <input
              type="text"
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

        <div className="col-span-4 flex justify-end gap-2 mt-2">
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
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm disabled:opacity-50"
              >
                <Save size={16} /> {loading ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center gap-1 text-sm disabled:opacity-50"
            >
              <Plus size={16} /> {loading ? "Adding..." : "Add Product Type"}
            </button>
          )}
        </div>
      </form>

      {/* Product table */}
      <div className="overflow-x-auto">
        <table className="w-full border text-sm rounded-lg">
          <thead className="bg-emerald-100 text-emerald-800">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Unit</th>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id} className="border-t hover:bg-gray-50">
                <td className="p-2">{p.name}</td>
                <td className="p-2">{p.category}</td>
                <td className="p-2">{p.unit}</td>
                <td className="p-2">{p.description}</td>
                <td className="p-2 flex gap-3 items-center">
                  <button
                    onClick={() => handleEdit(p)}
                    className="text-blue-500 hover:text-blue-700"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(p._id)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center text-gray-400 p-3">
                  No product types found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
