// src/layouts/MainLayout.jsx
import React, { useState } from "react";
import Sidebar from "../components/Sidebar";

export default function MainLayout({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleSidebar = () => setIsOpen((prev) => !prev);

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

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={isOpen} toggleSidebar={toggleSidebar} />

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
          className="flex-1 overflow-y-auto p-4 md:p-6"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
