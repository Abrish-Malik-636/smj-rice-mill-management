import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const activities = [
    "🧾 New ledger entry created for Al Rehman Traders",
    "📦 120 Bags of Rice (B1) added to stock",
    "💰 Payment received from Malik Sons",
    "⚙️ Production started for shift A - 350 bags",
  ];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-emerald-800">Welcome to SMJ Rice Mill</h1>
          <p className="text-gray-500">Efficient management starts here!</p>
        </div>

        {/* Interactive Date Picker */}
        <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-2 hover:shadow-md transition">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="eeee, MMM d, yyyy"
            className="w-48 text-center font-medium text-emerald-700 focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { title: "Cash in Hand", value: "Rs. 120,000", color: "emerald" },
          { title: "Bags Inward", value: "540", color: "blue" },
          { title: "Bags Outward", value: "430", color: "orange" },
          { title: "Pending Payments", value: "12", color: "red" },
        ].map((card, i) => (
          <div
            key={i}
            className={`border-l-4 border-${card.color}-500 bg-white shadow rounded-xl p-4 hover:shadow-lg transition`}
          >
            <h3 className="text-sm text-gray-500">{card.title}</h3>
            <p className="text-xl font-semibold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Activities */}
      <div className="bg-white shadow rounded-xl p-6">
        <h2 className="text-lg font-semibold text-emerald-700 mb-4">Recent Activities</h2>
        <ul className="space-y-2 text-gray-700">
          {activities.map((a, i) => (
            <li
              key={i}
              className="border-b border-gray-100 pb-2 hover:text-emerald-600 transition"
            >
              {a}
            </li>
          ))}
        </ul>
      </div>

      {/* Graph Placeholder */}
      <div className="mt-6 p-6 bg-white rounded-xl shadow text-center text-gray-400">
        📊 Stock graphs and insights will appear here once modules are connected.
      </div>
    </div>
  );
}
