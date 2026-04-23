# AQI Trends — Air Quality Trend Analysis

A full-stack web application for real-time air quality monitoring and trend analysis across major Indian and global cities.

🌐 **Live:** [aqitrends.online](https://aqitrends.online)

---

## Features

- **Real-time AQI monitoring** — Live air quality index data for 15+ Indian and 6 global cities via WAQI and OpenAQ APIs
- **Statistical analysis** — Mean, median, standard deviation, skewness, kurtosis, and Pearson correlation computed client-side
- **Trend forecasting** — OLS regression, Holt-Winters exponential smoothing, and ARIMA-based forecasting
- **Health recommendations** — Contextual health advisories based on current AQI levels
- **User accounts** — Email/password signup and Google OAuth login
- **Interactive charts** — Chart.js powered visualisations with annotation support

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Chart.js, React Router |
| Backend | Node.js, Express 5, Passport.js |
| Database | MongoDB (Mongoose) |
| Auth | JWT, Google OAuth 2.0 |
| Containerisation | Docker, Docker Compose |
| CI/CD | Jenkins → EC2 (SSH deploy) |

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) & Docker Compose
- Node.js v16+ *(local development only)*

### Environment Variables

Create a `.env` file in the project root:

```env
MONGO_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

> ⚠️ Never commit `.env` to version control — it is already in `.gitignore`.

To obtain Google OAuth credentials, create an OAuth 2.0 Client ID at [Google Cloud Console](https://console.cloud.google.com/) under **APIs & Services → Credentials**.

### Run with Docker (Recommended)

```bash
git clone https://github.com/sathwiksyr/Air-quality-trend-analysis_final.git
cd Air-quality-trend-analysis_final

# Add your .env file, then:
docker compose up --build -d
docker ps
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |

```bash
# Stop containers
docker compose down
```

### Run Locally

```bash
# Backend
cd backend && npm install && npm start

# Frontend (new terminal)
cd frontend && npm install && npm start
```

---

## CI/CD Pipeline

Automated Jenkins pipeline deploys to AWS EC2 on every push to `main`.

| Stage | Action |
|---|---|
| Checkout Code | Pulls latest from `main` |
| Deploy to EC2 | SSH into EC2, pull changes, rebuild and restart containers |

**Jenkins credentials required:** `MONGO_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ec2-ssh-key`

---

## Project Structure

```
├── backend/
│   ├── models/         # Mongoose User model
│   ├── server.js       # Express app, auth routes, API endpoints
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/ # Dashboard, LoginModal, OAuthSuccess
│   │   └── App.js
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
└── Jenkinsfile
```

---

## Team

| Name | GitHub |
|---|---|
| Sathwik S Y R | [@sathwiksyr](https://github.com/sathwiksyr) |
| Sai Deep | [@saideepeedara27-alt](https://github.com/saideepeedara27-alt) |
| Bharadwaj | [@bharadwajba](https://github.com/bharadwajba) |
| Jithendar | [@jithendarreddy123](https://github.com/jithendarreddy123) |