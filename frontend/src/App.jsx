// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import GatePass from "./pages/GatePass";
import Dashboard from "./pages/Dashboard";
import Financial from "./pages/Financial";
import Stock from "./pages/Stock";
import Production from "./pages/Production";
import Notifications from "./pages/Notifications";
import MasterData from "./pages/MasterData";
import HRPayroll from "./pages/HRPayroll";
import AccountingFinance from "./pages/AccountingFinance";
import Reports from "./pages/Reports";
import AIChatbot from "./components/AI/AIChatbot";

export default function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/financial" element={<Financial />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/stock-managerial" element={<Stock initialTab="managerial" />} />
          <Route path="/gatepass" element={<GatePass />} />
          <Route path="/gatepasses" element={<GatePass />} />
          <Route path="/production" element={<Production />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/hr-payroll" element={<HRPayroll />} />
          <Route path="/accounting-finance" element={<AccountingFinance />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/masterdata" element={<MasterData />} />
        </Routes>
        <AIChatbot />
      </MainLayout>
    </Router>
  );
}
