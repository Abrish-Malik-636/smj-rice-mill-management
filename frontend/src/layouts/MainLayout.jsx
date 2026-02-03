// src/layouts/MainLayout.jsx
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import Sidebar from "../components/Sidebar";
import api from "../services/api";
import Pin4Input from "../components/Pin4Input";

export default function MainLayout({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef(null);
  const [settings, setSettings] = useState({ loginPassword: "", adminPin: "", email: "", companyName: "", shortName: "" });
  const [authLocked, setAuthLocked] = useState(false);
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");

  const loadSettings = async () => {
    try {
      const res = await api.get("/settings");
      if (res.data?.data) {
        setSettings((prev) => ({ ...prev, ...res.data.data }));
      }
    } catch (err) {
      toast.error("Failed to load settings");
    }
  };

  useEffect(() => {
    const loggedIn = localStorage.getItem("smj_logged_in") === "true";
    setAuthLocked(!loggedIn);
    loadSettings();
  }, []);

  useEffect(() => {
    const onLogout = () => {
      localStorage.setItem("smj_logged_in", "false");
      setAuthLocked(true);
    };
    const onSettingsUpdate = () => loadSettings();
    const onKeyDown = (e) => {
      const target = e.target;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTyping) return;

      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.querySelector("[data-global-search]");
        if (searchInput) searchInput.focus();
        return;
      }
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        toast("Shortcuts: Alt+1..9 (modules), Alt+0 (Settings), [ ] (toggle sidebar), Ctrl+K (search), Esc (close)");
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
      if (e.altKey) {
        const key = e.key;
        const map = {
          "1": "/",
          "2": "/gatepass",
          "3": "/financial?tab=sale",
          "4": "/stock",
          "5": "/accounting-finance",
          "6": "/reports",
          "7": "/hr-payroll",
          "8": "/notifications",
          "9": "/ai/suggestions",
          "0": "/masterdata",
        };
        if (map[key]) {
          e.preventDefault();
          navigate(map[key]);
        }
      }
      if (e.key === "Escape") {
        window.dispatchEvent(new Event("smj-esc"));
      }
    };
    window.addEventListener("smj-logout", onLogout);
    window.addEventListener("smj-settings-updated", onSettingsUpdate);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("smj-logout", onLogout);
      window.removeEventListener("smj-settings-updated", onSettingsUpdate);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navigate]);

  const handleLogin = (pinOverride) => {
    const expectedPin = String(settings.loginPassword || settings.adminPin || "0000")
      .replace(/\D/g, "")
      .slice(0, 4);
    const enteredPin = String(pinOverride ?? loginPin ?? "")
      .replace(/\D/g, "")
      .slice(0, 4);
    if (enteredPin.length !== 4) {
      setLoginError("Enter 4-digit PIN");
      toast.error("Enter 4-digit PIN");
      return;
    }
    if (enteredPin === expectedPin) {
      localStorage.setItem("smj_logged_in", "true");
      setAuthLocked(false);
      setLoginPin("");
      setLoginError("");
      toast.success("Logged in");
    } else {
      setLoginError("PIN is incorrect");
      toast.error("Invalid PIN");
    }
  };

  // ----------------- SWIPE FOR MOBILE -----------------
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  const handleTouchStart = (e) => {
    if (window.innerWidth >= 768) return; // only mobile
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (window.innerWidth >= 768) return;
    setTouchEndX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;

    const distance = touchEndX - touchStartX;

    if (distance > 70) setIsOpen(true); // right swipe → open
    if (distance < -70) setIsOpen(false); // left swipe → close

    setTouchStartX(null);
    setTouchEndX(null);
  };
  // ---------------------------------------------------

  useLayoutEffect(() => {
    const mainEl = mainRef.current;
    if (mainEl) {
      mainEl.scrollTop = 0;
      mainEl.scrollLeft = 0;
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const raf = requestAnimationFrame(() => {
      if (mainEl) {
        mainEl.scrollTop = 0;
        mainEl.scrollLeft = 0;
      }
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => cancelAnimationFrame(raf);
  }, [location.pathname, location.search]);

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isOpen={isOpen}
        toggleSidebar={toggleSidebar}
        userName={settings.companyName || settings.shortName || "Admin User"}
        userEmail={settings.email || "admin@smjrice.pk"}
        onLogout={() => window.dispatchEvent(new Event("smj-logout"))}
      />

      {/* MAIN CONTENT */}
      <div
        className={`
          flex-1 flex flex-col

          /* DESKTOP → margin system for perfect sizing */
          transition-all duration-500 ease-out
          ${isOpen ? "md:ml-64" : "md:ml-16"}

          /* MOBILE → no margin, sidebar overlays */
          ml-0
        `}
      >
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto p-4 md:p-6"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {children}
        </main>
      </div>

      {authLocked && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-lg font-semibold text-gray-900">Login required</h3>
            <p className="text-xs text-gray-500 mt-1">
              Enter your 4-digit PIN to continue.
            </p>
            <div className="mt-4 space-y-3">
              <Pin4Input
                value={loginPin}
                onChange={(v) => {
                  setLoginPin(v.slice(0, 4));
                  if (loginError) setLoginError("");
                }}
                onComplete={(v) => handleLogin(v)}
                error={!!loginError}
              />
              {loginError && (
                <div className="text-xs text-red-600 text-center">{loginError}</div>
              )}
              {!settings.loginPassword && (
                <p className="text-xs text-amber-600">
                  No login PIN set. Default PIN: 0000.
                </p>
              )}
              <button
                type="button"
                onClick={() => handleLogin()}
                className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700"
              >
                Enter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
