// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import GatePass from "./pages/GatePass";
import Dashboard from "./pages/Dashboard";
import Financial from "./pages/Financial";
import Stock from "./pages/Stock";
import Production from "./pages/Production";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import MasterData from "./pages/MasterData";
import AIChatbot from "./components/AI/AIChatbot";
import AISuggestions from "./components/AI/AISuggestions";

export default function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/financial" element={<Financial />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/gatepass" element={<GatePass />} />
          <Route path="/production" element={<Production />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/masterdata" element={<MasterData />} />
          <Route path="/ai/suggestions" element={<AISuggestions />} />
        </Routes>
        <AIChatbot />
      </MainLayout>
    </Router>
  );
}
