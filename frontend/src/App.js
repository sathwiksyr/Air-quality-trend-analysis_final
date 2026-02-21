import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import LoginModal from "./components/LoginModal";
import Dashboard from "./components/Dashboard";
import OAuthSuccess from "./components/OAuthSuccess";
import "./App.css";

function App() {

  /* ================= LOGIN STATE ================= */
  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem("token")
  );

  /* ================= THEME STATE ================= */
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "dark"
  );

  /* ================= APPLY THEME ================= */
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Router>
      <div>

        {/* ================= THEME TOGGLE BUTTON ================= */}
        {isLoggedIn && (
          <div
            style={{
              position: "fixed",
              top: "15px",
              right: "120px",
              zIndex: 1000,
            }}
          >
            <button
              onClick={() =>
                setTheme(theme === "dark" ? "light" : "dark")
              }
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background:
                  theme === "dark" ? "#facc15" : "#1e293b",
                color:
                  theme === "dark" ? "#000" : "#fff",
              }}
            >
              {theme === "dark" ? "☀ Light" : "🌙 Dark"}
            </button>
          </div>
        )}

        {/* ================= ROUTES ================= */}
        <Routes>
          <Route
            path="/"
            element={
              !isLoggedIn ? (
                <LoginModal setIsLoggedIn={setIsLoggedIn} />
              ) : (
                <Dashboard
                  setIsLoggedIn={setIsLoggedIn}
                  theme={theme}
                />
              )
            }
          />

          <Route
            path="/oauth-success"
            element={
              <OAuthSuccess setIsLoggedIn={setIsLoggedIn} />
            }
          />
        </Routes>

      </div>
    </Router>
  );
}

export default App;