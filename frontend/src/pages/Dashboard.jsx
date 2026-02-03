// src/pages/Dashboard.jsx
import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import { Truck, Box, Coins, AlertTriangle } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import axios from "axios";

const leftAccent = {
  teal: "border-teal-400",
  blue: "border-sky-400",
  amber: "border-amber-400",
  red: "border-rose-400",
};

export default function Dashboard() {
  const [date, setDate] = useState(new Date());
  const [stats, setStats] = useState({
    cashInHand: 0,
    bagsInward: 0,
    bagsOutward: 0,
    pendingPayments: 0,
  });

  // fetch live dashboard data

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/dashboard");
        const data = res.data.data || {};

        setStats({
          cashInHand: data.totalExpenses || 0,
          bagsInward: data.todayTotalPaddyKg || 0,
          bagsOutward: data.todayTotalOutputKg || 0,
          pendingPayments: data.pendingPayments || 0,
        });
      } catch (err) {
        console.error("Dashboard data fetch failed:", err);
      }
    };

    fetchDashboardData();
  }, []);

  const cards = [
    {
      title: "Cash in Hand",
      value: `Rs. ${stats.cashInHand.toLocaleString()}`,
      icon: <Coins size={20} />,
      color: "teal",
    },
    {
      title: "Bags Inward",
      value: stats.bagsInward,
      icon: <Truck size={20} />,
      color: "blue",
    },
    {
      title: "Bags Outward",
      value: stats.bagsOutward,
      icon: <Box size={20} />,
      color: "amber",
    },
    {
      title: "Pending Payments",
      value: stats.pendingPayments,
      icon: <AlertTriangle size={20} />,
      color: "red",
    },
  ];

  const activities = [
    {
      title: "Inward Entry - Raw Paddy",
      meta: "ABC Traders · 85 bags · 5,525 kg · Just now",
      amount: "Rs. 3,85,000",
      color: "teal",
      icon: <Truck size={16} />,
    },
    {
      title: "Outward Entry - Premium Rice",
      meta: "XYZ Mills · 50 bags · 3,250 kg · 15 min ago",
      amount: "Rs. 2,60,000",
      color: "red",
      icon: <Box size={16} />,
    },
    {
      title: "Production Complete - Day Shift",
      meta: "Al-Barkat · Rice 850kg · 1 hour ago",
      amount: "92% Efficiency",
      color: "amber",
      icon: <Coins size={16} />,
    },
    {
      title: "Payment Received",
      meta: "ABC Traders · Invoice #SMJ-2025-089 · 2 hours ago",
      amount: "Rs. 1,50,000",
      color: "blue",
      icon: <Coins size={16} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-emerald-900">
            Welcome back!
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Here's what's happening today
          </p>
        </div>

        {/* calendar badge */}
        <div className="rounded-lg px-4 py-2 bg-gradient-to-r from-emerald-200 to-teal-100 shadow-sm w-full md:w-auto">
          <DatePicker
            selected={date}
            onChange={(d) => setDate(d)}
            dateFormat="EEE, MMM d, yyyy"
            className="bg-transparent border-none outline-none focus:ring-0 hover:border-none text-sm font-medium text-emerald-900 w-full md:w-44 text-center cursor-pointer"
            readOnly
          />
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div
            key={i}
            className={`bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition transform hover:-translate-y-1 border-l-4 ${
              leftAccent[c.color]
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-gray-400">{c.title}</div>
                <div className="text-2xl font-semibold text-emerald-900 mt-1">
                  {c.value}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Data from production module
                </div>
              </div>
              <div className="text-emerald-600">{c.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activities + Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-emerald-700">
              Recent Activities
            </h3>
            <button className="px-3 py-1 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition">
              View All
            </button>
          </div>

          <div className="space-y-3">
            {activities.map((a, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md hover:bg-gray-50 transition"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-md flex items-center justify-center text-white`}
                    style={{
                      background:
                        a.color === "teal"
                          ? "#0f766e"
                          : a.color === "red"
                          ? "#be123c"
                          : a.color === "amber"
                          ? "#c2410c"
                          : "#0ea5e9",
                    }}
                  >
                    {a.icon}
                  </div>
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-gray-400 mt-1">{a.meta}</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-800">
                  {a.amount}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm p-4">
          <h4 className="font-semibold text-emerald-700 mb-4">Stock Summary</h4>
          <div className="h-44 flex items-center justify-center text-gray-400">
            📊 Graph placeholder
          </div>
        </div>
      </div>
    </div>
  );
}
