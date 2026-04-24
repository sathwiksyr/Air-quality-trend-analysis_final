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