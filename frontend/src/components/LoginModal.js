import React, { useState } from "react";
import axios from "axios";
import "./Login.css";

function LoginModal({ setIsLoggedIn }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Get API base URL from .env
  const API_URL = process.env.REACT_APP_API_URL;

  const handleAuth = async () => {
    try {
      if (!email || !password) {
        alert("Please enter email and password");
        return;
      }

      if (isSignup) {
        await axios.post(`${API_URL}/api/signup`, {
          email,
          password,
        });

        alert("Signup successful! Please login.");
        setIsSignup(false);
      } else {
        const res = await axios.post(`${API_URL}/api/login`, {
          email,
          password,
        });

        localStorage.setItem("token", res.data.token);
        setIsLoggedIn(true);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Something went wrong");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isSignup ? "Create Account" : "Welcome Back"}</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="primary-btn" onClick={handleAuth}>
          {isSignup ? "Sign Up" : "Login"}
        </button>

        <div className="divider">OR</div>

        <button className="google-btn" onClick={handleGoogleLogin}>
          Continue with Google
        </button>

        <button className="linkedin-btn">
          Continue with LinkedIn
        </button>

        <p
          className="switch-text"
          onClick={() => setIsSignup(!isSignup)}
        >
          {isSignup
            ? "Already have an account? Login"
            : "New user? Sign Up"}
        </p>
      </div>
    </div>
  );
}

export default LoginModal;