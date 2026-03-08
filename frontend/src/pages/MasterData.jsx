// src/pages/MasterData.jsx
import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import SystemSettings from "../components/MasterData/SystemSettings";

export default function MasterData() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab !== "system") {
      setSearchParams({ tab: "system" }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <SystemSettings />
  );
}
