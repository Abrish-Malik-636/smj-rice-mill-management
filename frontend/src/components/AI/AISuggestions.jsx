import React, { useState, useEffect } from "react";
import {
  Lightbulb,
  TrendingUp,
  AlertCircle,
  Check,
  X,
  Loader,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";

export default function AISuggestions() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchSuggestions();
  }, [filter]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== "all") params.status = filter;

      const res = await api.get("/ai/suggestions", { params });
      if (res.data && res.data.success) {
        setSuggestions(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await api.patch(`/ai/suggestions/${id}/status`, { status });
      if (res.data && res.data.success) {
        toast.success(`Suggestion ${status}`);
        fetchSuggestions();
      }
    } catch (err) {
      toast.error("Failed to update suggestion");
    }
  };

  const deleteSuggestion = async (id) => {
    try {
      await api.delete(`/ai/suggestions/${id}`);
      toast.success("Suggestion deleted");
      fetchSuggestions();
    } catch (err) {
      toast.error("Failed to delete suggestion");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "gatepass":
        return "🚛";
      case "inventory":
        return "📦";
      case "pricing":
        return "💰";
      case "customer":
        return "👤";
      default:
        return "💡";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header - Emerald Theme */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Lightbulb className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Suggestions</h2>
            <p className="text-emerald-100 text-sm">
              Smart recommendations to improve your business operations
            </p>
          </div>
        </div>
      </div>

      {/* Filters - Emerald Theme */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "accepted", "rejected"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                filter === status
                  ? "bg-emerald-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Suggestions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow p-8 flex items-center justify-center">
            <Loader className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="ml-2 text-gray-600">Loading suggestions...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-emerald-50 rounded-full flex items-center justify-center">
              <TrendingUp className="w-10 h-10 text-emerald-500" />
            </div>
            <p className="text-gray-700 font-semibold">
              No suggestions available
            </p>
            <p className="text-sm text-gray-500 mt-1">
              AI will analyze your data and provide insights soon
            </p>
          </div>
        ) : (
          suggestions.map((suggestion) => (
            <div
              key={suggestion._id}
              className="bg-white rounded-xl shadow hover:shadow-lg transition-all duration-200 p-5 border border-gray-100 hover:border-emerald-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  {/* Icon */}
                  <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                    {getTypeIcon(suggestion.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-base">
                        {suggestion.title}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
                          suggestion.priority
                        )}`}
                      >
                        {suggestion.priority}
                      </span>
                      {suggestion.status === "applied" && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium">
                          ✓ Applied
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                      {suggestion.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 font-medium">
                        {suggestion.type}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(suggestion.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  {suggestion.status === "pending" && (
                    <>
                      <button
                        onClick={() => updateStatus(suggestion._id, "accepted")}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Accept"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(suggestion._id, "rejected")}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  {suggestion.status === "accepted" && (
                    <button
                      onClick={() => updateStatus(suggestion._id, "applied")}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm"
                    >
                      Apply Now
                    </button>
                  )}
                  {suggestion.status !== "pending" && (
                    <button
                      onClick={() => deleteSuggestion(suggestion._id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats Footer (Optional) */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-600">
                {suggestions.length}
              </p>
              <p className="text-xs text-gray-600">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {suggestions.filter((s) => s.status === "pending").length}
              </p>
              <p className="text-xs text-gray-600">Pending</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {suggestions.filter((s) => s.status === "accepted").length}
              </p>
              <p className="text-xs text-gray-600">Accepted</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">
                {suggestions.filter((s) => s.status === "applied").length}
              </p>
              <p className="text-xs text-gray-600">Applied</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
