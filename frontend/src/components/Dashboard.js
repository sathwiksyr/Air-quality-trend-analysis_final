import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

function Dashboard({ setIsLoggedIn }) {
  const [data, setData] = useState([]);
  const [user, setUser] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setIsLoggedIn(false);
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    axios
      .get(`${API_URL}/api/airdata`, { headers })
      .then((res) => setData(res.data))
      .catch(() => {
        localStorage.removeItem("token");
        setIsLoggedIn(false);
      });

    axios
      .get(`${API_URL}/api/user`, { headers })
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("token");
        setIsLoggedIn(false);
      });

  }, [API_URL, setIsLoggedIn]);

  /* ================= BASIC ANALYTICS ================= */

  const avgAQI = data.length
    ? (data.reduce((sum, item) => sum + item.aqi, 0) / data.length).toFixed(1)
    : 0;

  const maxPM = data.length
    ? Math.max(...data.map((item) => item.pm25))
    : 0;

  /* ================= YEARLY TREND ================= */

  const yearlyData = {};
  data.forEach((item) => {
    const year = new Date(item.date).getFullYear();
    if (!yearlyData[year]) yearlyData[year] = [];
    yearlyData[year].push(item.aqi);
  });

  const years = Object.keys(yearlyData);

  const yearlyAvgAQI = years.map(
    (year) =>
      yearlyData[year].reduce((a, b) => a + b, 0) /
      yearlyData[year].length
  );

  /* ================= TREND CALCULATION ================= */

  function calculateRegression(values) {
    const n = values.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

    const x = Array.from({ length: n }, (_, i) => i);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * values[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);

    const slope =
      (n * sumXY - sumX * sumY) /
      (n * sumX2 - sumX * sumX);

    const intercept = (sumY - slope * sumX) / n;

    const meanY = sumY / n;
    const ssTot = values.reduce((a, y) => a + (y - meanY) ** 2, 0);
    const ssRes = values.reduce(
      (a, y, i) => a + (y - (slope * i + intercept)) ** 2,
      0
    );

    const r2 = 1 - ssRes / ssTot;

    return { slope, intercept, r2 };
  }

  const { slope: trendSlope, intercept, r2 } =
    calculateRegression(yearlyAvgAQI);

  const predictedNextYear =
    yearlyAvgAQI.length
      ? yearlyAvgAQI[yearlyAvgAQI.length - 1] + trendSlope
      : 0;

  /* ================= GROWTH RATE ================= */

  const growthRate =
    yearlyAvgAQI.length > 1
      ? (
          ((yearlyAvgAQI[yearlyAvgAQI.length - 1] -
            yearlyAvgAQI[0]) /
            yearlyAvgAQI[0]) *
          100
        ).toFixed(2)
      : 0;

  /* ================= 3-YEAR FORECAST ================= */

  const forecastYears = ["+1", "+2", "+3"];
  const forecastValues = forecastYears.map(
    (_, i) =>
      trendSlope * (yearlyAvgAQI.length + i) + intercept
  );

  /* ================= CHART CONFIG ================= */

  const trendChart = {
    labels: [...years, ...forecastYears],
    datasets: [
      {
        label: "Yearly AQI Trend",
        data: [...yearlyAvgAQI, null, null, null],
        borderColor: "#f97316",
        backgroundColor: "rgba(249,115,22,0.2)",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Regression Line",
        data: [
          ...yearlyAvgAQI.map((_, i) => trendSlope * i + intercept),
          ...forecastValues,
        ],
        borderColor: "#22c55e",
        borderDash: [5, 5],
        tension: 0.4,
      },
      {
        label: "Forecast",
        data: [
          ...Array(yearlyAvgAQI.length).fill(null),
          ...forecastValues,
        ],
        borderColor: "#38bdf8",
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    animation: { duration: 1200 },
    plugins: { legend: { position: "top" } },
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
  };

  return (
    <div style={{ background:"#0b1f3a", minHeight:"100vh", color:"white", padding:"30px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h1>Air Quality Dashboard</h1>

        {user && (
          <div style={{ display:"flex", alignItems:"center", gap:"15px" }}>
            <img
              src={user.profilePic}
              alt="profile"
              style={{ width:"40px", borderRadius:"50%" }}
            />
            <span>{user.name}</span>
            <button
              onClick={handleLogout}
              style={{
                background:"#f43f5e",
                color:"white",
                border:"none",
                padding:"8px 15px",
                borderRadius:"5px",
                cursor:"pointer"
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(200px,1fr))",
        gap:"20px",
        marginTop:"30px"
      }}>
        <Card title="Average AQI" value={avgAQI} />
        <Card title="Max PM2.5" value={maxPM} />
        <Card title="Trend Slope (β₁)" value={trendSlope.toFixed(2)} />
        <Card title="R² Value" value={r2.toFixed(2)} />
        <Card title="Growth %" value={growthRate + "%"} />
        <Card title="Predicted Next Year AQI" value={predictedNextYear.toFixed(1)} />
      </div>

      <Section title="Pollution Trend + Forecast">
        <Line data={trendChart} options={options} />
      </Section>
    </div>
  );
}

const Card = ({ title, value }) => (
  <div style={{
    background:"#1c3c5d",
    padding:"20px",
    borderRadius:"10px",
    textAlign:"center"
  }}>
    <h3>{title}</h3>
    <h2>{value}</h2>
  </div>
);

const Section = ({ title, children }) => (
  <div style={{
    marginTop:"40px",
    background:"#122b4a",
    padding:"20px",
    borderRadius:"10px"
  }}>
    <h2 style={{ marginBottom:"15px" }}>{title}</h2>
    {children}
  </div>
);

export default Dashboard;