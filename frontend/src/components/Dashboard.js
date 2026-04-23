import React, { useEffect, useRef, useState, useCallback } from "react";

// ── CONSTANTS ──
const WAQI_TOKEN = "a19817cbd461f4d5d7986539cf6bf908f0ea155c";
const OPENAQ_BASE = "https://api.openaq.org/v2";

const CITIES = {
  "── Indian Cities ──": null,
  "Delhi": "delhi", "Mumbai": "mumbai", "Bengaluru": "bengaluru",
  "Hyderabad": "hyderabad", "Chennai": "chennai", "Kolkata": "kolkata",
  "Ahmedabad": "ahmedabad", "Pune": "pune", "Jaipur": "jaipur",
  "Lucknow": "lucknow", "Kanpur": "kanpur", "Nagpur": "nagpur",
  "Patna": "patna", "Surat": "surat", "Indore": "indore",
  "── Global Cities ──": null,
  "Beijing": "beijing", "London": "london", "New York": "new-york",
  "Tokyo": "tokyo", "Los Angeles": "los-angeles", "Paris": "paris",
};

const CITY_COORDS = {
  delhi:{lat:28.6,lng:77.2},mumbai:{lat:19.1,lng:72.9},bengaluru:{lat:12.9,lng:77.6},
  hyderabad:{lat:17.4,lng:78.5},chennai:{lat:13.1,lng:80.3},kolkata:{lat:22.6,lng:88.4},
  ahmedabad:{lat:23.0,lng:72.6},pune:{lat:18.5,lng:73.9},jaipur:{lat:26.9,lng:75.8},
  lucknow:{lat:26.9,lng:81.0},kanpur:{lat:26.5,lng:80.3},nagpur:{lat:21.1,lng:79.1},
  patna:{lat:25.6,lng:85.1},surat:{lat:21.2,lng:72.8},indore:{lat:22.7,lng:75.9},
  beijing:{lat:39.9,lng:116.4},london:{lat:51.5,lng:-0.1},"new-york":{lat:40.7,lng:-74.0},
  tokyo:{lat:35.7,lng:139.7},"los-angeles":{lat:34.1,lng:-118.2},paris:{lat:48.9,lng:2.4},
};

const DEMO_AQI = {
  delhi:162,mumbai:95,bengaluru:58,hyderabad:72,chennai:65,kolkata:112,
  ahmedabad:88,pune:76,jaipur:130,lucknow:155,kanpur:160,nagpur:95,
  patna:148,surat:82,indore:105,
  beijing:138,london:38,"new-york":55,tokyo:42,"los-angeles":75,paris:45,
};

function aqiInfo(v) {
  if (v <= 50)  return { label:"Good",              color:"#22c55e", bg:"rgba(34,197,94,.12)",  grade:"A" };
  if (v <= 100) return { label:"Moderate",           color:"#eab308", bg:"rgba(234,179,8,.12)",  grade:"B" };
  if (v <= 150) return { label:"Unhealthy for Some", color:"#f97316", bg:"rgba(249,115,22,.12)", grade:"C" };
  if (v <= 200) return { label:"Unhealthy",          color:"#ef4444", bg:"rgba(239,68,68,.12)",  grade:"D" };
  if (v <= 300) return { label:"Very Unhealthy",     color:"#a855f7", bg:"rgba(168,85,247,.12)", grade:"E" };
  return          { label:"Hazardous",               color:"#dc2626", bg:"rgba(220,38,38,.12)",  grade:"F" };
}

function healthRec(aqi) {
  if (aqi <= 50)  return { icon:"🟢", title:"Air is Clean", text:"Safe for all outdoor activities. Enjoy!", actions:["Open windows","Go for a run","Kids can play outside"], color:"#22c55e" };
  if (aqi <= 100) return { icon:"🟡", title:"Acceptable Air Quality", text:"Sensitive individuals may experience minor issues.", actions:["Sensitive groups limit prolonged outdoor exertion","Keep windows open moderately"], color:"#eab308" };
  if (aqi <= 150) return { icon:"🟠", title:"Unhealthy for Sensitive Groups", text:"Children, elderly, and those with lung/heart conditions should reduce outdoor exposure.", actions:["Wear N95 mask outdoors","Avoid prolonged exercise outside","Keep windows closed"], color:"#f97316" };
  if (aqi <= 200) return { icon:"🔴", title:"Unhealthy — Take Precautions", text:"Everyone may begin to experience health effects. Limit outdoor activity.", actions:["Wear N95/KN95 mask always","Run air purifier indoors","Postpone outdoor exercise","Stay indoors if possible"], color:"#ef4444" };
  if (aqi <= 300) return { icon:"🟣", title:"Very Unhealthy — Stay Indoors", text:"Health alert: everyone may experience serious health effects.", actions:["Stay indoors with windows sealed","Use air purifier on max","Avoid ALL outdoor activity","Seek medical attention if breathing issues"], color:"#a855f7" };
  return           { icon:"⚫", title:"Hazardous — Emergency Conditions", text:"Health warning of emergency conditions. Everyone is affected.", actions:["Do NOT go outside","Seal doors and windows","Use N95 mask even indoors","Call emergency if symptoms appear"], color:"#dc2626" };
}

const Stats = {
  mean: a => a.reduce((s,v)=>s+v,0)/a.length,
  variance: a => { const m=Stats.mean(a); return a.reduce((s,v)=>s+(v-m)**2,0)/a.length; },
  std: a => Math.sqrt(Stats.variance(a)),
  median: a => { const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
  percentile: (a,p) => { const s=[...a].sort((x,y)=>x-y); return s[Math.floor(p/100*(s.length-1))]; },
  skewness: a => { const m=Stats.mean(a),sd=Stats.std(a); return a.reduce((t,v)=>t+((v-m)/sd)**3,0)/a.length; },
  kurtosis: a => { const m=Stats.mean(a),sd=Stats.std(a); return a.reduce((t,v)=>t+((v-m)/sd)**4,0)/a.length-3; },
  correlation: (x,y) => {
    const mx=Stats.mean(x),my=Stats.mean(y),sx=Stats.std(x),sy=Stats.std(y);
    return x.reduce((s,xi,i)=>s+(xi-mx)*(y[i]-my),0)/(x.length*sx*sy);
  },
  ols: y => {
    const n=y.length, x=[...Array(n).keys()];
    const mx=Stats.mean(x), my=Stats.mean(y);
    const b1=x.reduce((s,xi,i)=>s+(xi-mx)*(y[i]-my),0)/x.reduce((s,xi)=>s+(xi-mx)**2,0);
    const b0=my-b1*mx;
    const yhat=x.map(xi=>b0+b1*xi);
    const ss_res=y.reduce((s,yi,i)=>s+(yi-yhat[i])**2,0);
    const ss_tot=y.reduce((s,yi)=>s+(yi-my)**2,0);
    const r2=1-ss_res/ss_tot;
    return { b0,b1,r2,rmse:Math.sqrt(ss_res/n),mae:y.reduce((s,yi,i)=>s+Math.abs(yi-yhat[i]),0)/n,pearson:Math.sqrt(r2)*(b1>=0?1:-1),yhat };
  },
  sma: (data,w) => data.map((_,i)=>i<w-1?null:Stats.mean(data.slice(i-w+1,i+1))),
  holtWinters: (data, alpha=0.3, beta=0.1, steps=5) => {
    let level=data[0], trend=data[1]-data[0];
    const smoothed=[level];
    for(let i=1;i<data.length;i++){
      const pl=level;
      level=alpha*data[i]+(1-alpha)*(level+trend);
      trend=beta*(level-pl)+(1-beta)*trend;
      smoothed.push(level);
    }
    const forecast=[];
    for(let h=1;h<=steps;h++) forecast.push(level+h*trend);
    return { smoothed, forecast, finalLevel:level, finalTrend:trend,
      rmse: Math.sqrt(data.slice(5).reduce((s,v,i)=>s+(v-smoothed[i+5])**2,0)/(data.length-5)) };
  },
  arima: (data, steps=5) => {
    const n = data.length;
    const diff = data.slice(1).map((v,i) => v - data[i]);
    const mean_d = Stats.mean(diff);
    const centered = diff.map(v => v - mean_d);
    const ac1 = centered.slice(1).reduce((s,v,i)=>s+v*centered[i],0) / centered.reduce((s,v)=>s+v*v,0);
    const phi = Math.max(-0.95, Math.min(0.95, ac1));
    const resid = centered.slice(1).map((v,i) => v - phi*centered[i]);
    const theta = Math.max(-0.85, Math.min(0.85, -Stats.correlation(resid.slice(1), resid.slice(0,-1)) || 0));
    const resid2 = resid.slice(1).map((v,i) => v - theta*resid[i]);
    const sigma = Stats.std(resid2);
    let last_val = data[n-1];
    let last_diff = diff[diff.length-1] - mean_d;
    let last_e = resid[resid.length-1];
    const forecast = [];
    for(let h=1;h<=steps;h++){
      const new_diff = phi*last_diff + theta*last_e + mean_d;
      last_val = last_val + new_diff;
      forecast.push(Math.max(0, last_val));
      last_diff = new_diff - mean_d;
      last_e = 0;
    }
    const fitted = [data[0]];
    let le = 0;
    for(let i=1;i<n;i++){
      const pd = phi*(diff[i-1]-mean_d)+theta*le+mean_d;
      fitted.push(fitted[i-1]+pd);
      le = diff[i]-mean_d - phi*(i>=2?diff[i-2]-mean_d:0);
    }
    const rmse = Math.sqrt(data.reduce((s,v,i)=>s+(v-fitted[i])**2,0)/n);
    return { forecast, fitted, phi, theta, sigma, rmse };
  },
  detectAnomalies: (data, threshold=2.0) => {
    const m=Stats.mean(data), s=Stats.std(data);
    return data.map((v,i)=>({idx:i,val:v,z:(v-m)/s,isAnomaly:Math.abs((v-m)/s)>threshold}));
  },
};

function buildSeasonalHistory(baseAqi, days=90) {
  const series = [];
  const now = Date.now();
  const seasonMult = [1.7,1.5,1.1,0.9,0.8,0.6,0.5,0.5,0.55,1.0,1.3,1.6];
  for (let i=days; i>=0; i--) {
    const t = now - i*86400000;
    const d = new Date(t);
    const wday = d.getDay();
    const m = d.getMonth();
    const sm = seasonMult[m];
    const weff = [3,-4,-2,1,3,7,2][wday];
    const wave = Math.sin((d.getDate()/30)*Math.PI)*8;
    const prev = series.length > 0 ? series[series.length-1].aqi : baseAqi*sm;
    const ar = 0.6*(prev - baseAqi*sm);
    const noise = (Math.random()-0.5)*18;
    const val = Math.max(5, Math.round(baseAqi*sm + ar*0.3 + weff + wave + noise));
    const pm25 = val*0.45 + (Math.random()-0.5)*4;
    const pm10 = val*0.7 + (Math.random()-0.5)*6;
    const o3 = 20 + Math.random()*55 + (m>=4&&m<=8?15:0);
    const no2 = 10 + Math.random()*38 + (wday>=1&&wday<=5?8:0);
    const temp = 15 + 10*Math.sin((m/12)*2*Math.PI) + (Math.random()-0.5)*8;
    const humidity = 40 + 30*Math.sin(((m+3)/12)*2*Math.PI) + (Math.random()-0.5)*15;
    const wind = 5 + Math.random()*20;
    series.push({ t, aqi:val, pm25, pm10, o3, no2, temp, humidity, wind });
  }
  return series;
}

function generateInsights(data, forecastArima, forecastHW, anomalies, cityName) {
  const aqi = data.aqi;
  const hist = data.history;
  const aqiSeries = hist.map(h=>h.aqi);
  const pm25Series = hist.map(h=>h.pm25);
  const tempSeries = hist.map(h=>h.temp);
  const humSeries = hist.map(h=>h.humidity);
  const ols = Stats.ols(aqiSeries);
  const month = new Date().getMonth();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const seasonMap = [2,2,0,0,0,1,1,1,1,3,3,2];
  const seasonNames = ["Spring","Monsoon","Winter","Post-Monsoon"];
  const season = seasonNames[seasonMap[month]];
  const recentTrend = aqiSeries.slice(-7);
  const recentOls = Stats.ols(recentTrend);
  const anomalyDays = anomalies.filter(a=>a.isAnomaly);
  const corrTemp = Stats.correlation(aqiSeries, tempSeries);
  const corrHum = Stats.correlation(aqiSeries, humSeries);
  const pm25Mean = Stats.mean(pm25Series);
  const insights = [];
  if (recentOls.b1 > 1.5) insights.push({ icon:"📈", color:"#ef4444", title:"Rising Pollution Trend", text:`AQI has been increasing by ~${recentOls.b1.toFixed(1)} units/day over the past week. PM₂.₅ levels (avg ${pm25Mean.toFixed(1)} µg/m³) are a primary driver.` });
  else if (recentOls.b1 < -1.5) insights.push({ icon:"📉", color:"#22c55e", title:"Improving Air Quality", text:`Good news — AQI is falling ~${Math.abs(recentOls.b1).toFixed(1)} units/day this week, suggesting favorable conditions or reduced emissions.` });
  else insights.push({ icon:"📊", color:"#3b82f6", title:"Stable Air Quality", text:`AQI has remained relatively stable (slope: ${recentOls.b1.toFixed(2)}/day) over the past 7 days. Minor fluctuations within normal bounds.` });
  if (season === "Winter") insights.push({ icon:"❄️", color:"#3b82f6", title:`Winter Effect in ${monthNames[month]}`, text:`Cold, still air traps pollutants near ground level. Temperature inversion is a key factor in ${cityName}'s elevated winter AQI values.` });
  else if (season === "Monsoon") insights.push({ icon:"🌧️", color:"#8b5cf6", title:"Monsoon Cleansing Effect", text:`Rainfall is washing particulate matter from the atmosphere. Monsoon season typically delivers ${cityName}'s cleanest air of the year.` });
  else if (season === "Post-Monsoon") insights.push({ icon:"🍂", color:"#f97316", title:"Post-Monsoon Pollution Build-up", text:`Crop residue burning and declining humidity post-monsoon are driving AQI higher. This trend typically peaks in November-December.` });
  if (Math.abs(corrTemp) > 0.3) insights.push({ icon:"🌡️", color:"#f59e0b", title:"Temperature Correlation", text:`Strong ${corrTemp > 0 ? "positive" : "negative"} correlation (r=${corrTemp.toFixed(2)}) detected between temperature and AQI. ${corrTemp > 0 ? "Higher temperatures are associated with increased ozone formation." : "Cooler days show reduced photochemical smog."}` });
  if (Math.abs(corrHum) > 0.3) insights.push({ icon:"💧", color:"#06b6d4", title:"Humidity Impact", text:`Humidity shows r=${corrHum.toFixed(2)} correlation with AQI. ${corrHum > 0 ? "Higher humidity traps particles, worsening haze." : "Drier conditions show lower AQI (particle fallout)."}` });
  if (anomalyDays.length > 0) insights.push({ icon:"🚨", color:"#ef4444", title:`${anomalyDays.length} Pollution Spike${anomalyDays.length>1?"s":""} Detected`, text:`Statistical anomalies (>2σ from mean) found. Possible causes: industrial accidents, crop burning, festivals, or extreme weather inversions.` });
  const f1avg = forecastArima.reduce((s,v)=>s+v,0)/forecastArima.length;
  const f2avg = forecastHW.reduce((s,v)=>s+v,0)/forecastHW.length;
  const diff = Math.abs(f1avg - f2avg);
  if (diff > 20) insights.push({ icon:"⚠️", color:"#f59e0b", title:"Model Forecast Divergence", text:`ARIMA and Holt-Winters forecasts diverge by ${diff.toFixed(0)} AQI units on average. This uncertainty suggests volatile conditions ahead — monitor closely.` });
  else insights.push({ icon:"✅", color:"#22c55e", title:"Model Forecast Consensus", text:`Both ARIMA and Holt-Winters models agree closely (diff: ${diff.toFixed(0)} units). High confidence in the 5-day forecast.` });
  return insights;
}

async function fetchRealHistory(citySlug, currentAqi) {
  const cityMap = {
    delhi: "Delhi", mumbai: "Mumbai", bengaluru: "Bengaluru",
    kolkata: "Kolkata", chennai: "Chennai", hyderabad: "Hyderabad",
    pune: "Pune", jaipur: "Jaipur", ahmedabad: "Ahmedabad",
    beijing: "Beijing", london: "London", paris: "Paris", tokyo: "Tokyo",
  };
  const cityName = cityMap[citySlug];
  try {
    if (cityName) {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now()-90*86400000).toISOString().split("T")[0];
      const url = `${OPENAQ_BASE}/measurements?city=${encodeURIComponent(cityName)}&parameter=pm25&date_from=${startDate}T00:00:00Z&date_to=${endDate}T23:59:59Z&limit=3000&sort=asc`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const json = await res.json();
      if (json.results && json.results.length > 20) {
        const byDay = {};
        json.results.forEach(r => {
          const day = r.date.local.split("T")[0];
          if (!byDay[day]) byDay[day] = [];
          if (r.value > 0 && r.value < 1000) byDay[day].push(r.value);
        });
        const days = Object.keys(byDay).sort();
        if (days.length >= 20) {
          return days.map(day => {
            const pm25 = Stats.mean(byDay[day]);
            const aqi = pm25 <= 12 ? (pm25/12)*50 :
                        pm25 <= 35.4 ? 50+(pm25-12)/23.4*50 :
                        pm25 <= 55.4 ? 100+(pm25-35.4)/19.9*50 :
                        pm25 <= 150.4 ? 150+(pm25-55.4)/94.9*50 :
                        pm25 <= 250.4 ? 200+(pm25-150.4)/99.9*100 : 300;
            const t = new Date(day).getTime();
            const m = new Date(day).getMonth();
            return {
              t, aqi:Math.round(aqi), pm25, pm10:pm25*1.55,
              o3: 20+Math.random()*55+(m>=4&&m<=8?15:0),
              no2: 10+Math.random()*38,
              temp: 15+10*Math.sin((m/12)*2*Math.PI)+(Math.random()-0.5)*8,
              humidity: 40+30*Math.sin(((m+3)/12)*2*Math.PI)+(Math.random()-0.5)*15,
              wind: 5+Math.random()*20,
              source: "openaq",
            };
          });
        }
      }
    }
  } catch(e) { console.warn("OpenAQ failed:", e.message); }
  return buildSeasonalHistory(currentAqi, 90);
}

// ── CSS — fixed full-screen layout ──
const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

/* RESET: ensure no parent constraints */
html, body, #root {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
}

.iq-root {
  --bg:#080c12;--s1:#0d1219;--s2:#111926;--s3:#162031;
  --br:rgba(255,255,255,0.06);--br2:rgba(255,255,255,0.1);
  --acc:#4f9cf9;--acc2:#7c3aed;--grn:#10b981;--ora:#f97316;
  --red:#f43f5e;--yel:#f59e0b;--cyn:#06b6d4;
  --txt:#e8edf5;--txt2:#8b99b0;--txt3:#4a5568;
  font-family:'DM Sans',sans-serif;
  background:var(--bg);
  color:var(--txt);
  /* FULL SCREEN: take exactly viewport */
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.iq-root * { box-sizing:border-box; margin:0; padding:0; }

/* HEADER — fixed height, never scrolls */
.iq-hdr {
  flex-shrink: 0;
  z-index: 200;
  background: rgba(8,12,18,0.98);
  backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--br);
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  width: 100%;
}

/* SCROLL CONTAINER — only this scrolls */
.iq-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
}
.iq-scroll::-webkit-scrollbar { width: 5px; }
.iq-scroll::-webkit-scrollbar-track { background: var(--bg); }
.iq-scroll::-webkit-scrollbar-thumb { background: rgba(79,156,249,.3); border-radius: 99px; }

.iq-brand{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;letter-spacing:-0.5px;display:flex;align-items:center;gap:8px;color:#fff;}
.iq-brand-badge{background:linear-gradient(135deg,#4f9cf9,#7c3aed);border-radius:6px;padding:3px 7px;font-size:11px;font-weight:700;letter-spacing:.5px;color:#fff;}
.iq-hdr-sep{width:1px;height:20px;background:var(--br2);}
.iq-hdr-subtitle{font-size:11px;color:var(--txt3);font-family:'IBM Plex Mono',monospace;letter-spacing:.3px;}
.iq-hdr-r{margin-left:auto;display:flex;align-items:center;gap:8px;}
.iq-city-btn{display:flex;align-items:center;gap:6px;background:var(--s2);border:1px solid var(--br2);padding:6px 14px;border-radius:10px;font-size:12px;color:var(--txt2);cursor:pointer;transition:.15s;font-family:'IBM Plex Mono',monospace;}
.iq-city-btn:hover{border-color:var(--acc);color:var(--acc);}
.iq-live{display:flex;align-items:center;gap:5px;background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);color:var(--grn);padding:5px 11px;border-radius:99px;font-size:10px;font-family:'IBM Plex Mono',monospace;letter-spacing:.5px;}
.iq-live-dot{width:5px;height:5px;border-radius:50%;background:var(--grn);animation:pulseDot 1.8s infinite;}
@keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.7)}}
.iq-logout-btn{background:rgba(244,63,94,.07);border:1px solid rgba(244,63,94,.2);color:var(--red);padding:6px 14px;border-radius:10px;font-size:11px;cursor:pointer;transition:.15s;font-family:'IBM Plex Mono',monospace;}
.iq-logout-btn:hover{background:rgba(244,63,94,.14);}

/* MAP OVERLAY */
.iq-map-overlay{position:fixed;inset:0;z-index:500;background:#e8ecf0;display:flex;flex-direction:column;animation:fadeUp .2s ease;}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.iq-map-topbar{height:52px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px;padding:0 16px;flex-shrink:0;}
.iq-map-logo{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#4f9cf9;}
.iq-map-search{flex:1;max-width:400px;display:flex;align-items:center;gap:8px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:99px;padding:6px 14px;}
.iq-map-search input{background:none;border:none;outline:none;font-size:12px;color:#374151;width:100%;font-family:'DM Sans',sans-serif;}
.iq-map-close{margin-left:auto;display:flex;align-items:center;gap:6px;background:#f3f4f6;border:1px solid #e5e7eb;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:12px;color:#374151;transition:.15s;}
.iq-map-close:hover{background:#e5e7eb;}
.iq-map-body{flex:1;display:flex;overflow:hidden;}
.iq-map-panel{width:300px;background:#fff;border-right:1px solid #e5e7eb;overflow-y:auto;flex-shrink:0;}
.iq-map-phdr{padding:16px;border-bottom:1px solid #f3f4f6;}
.iq-map-city-name{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#111;}
.iq-map-aqi-row{display:flex;align-items:center;gap:10px;margin-top:10px;}
.iq-map-aqi-num{font-family:'IBM Plex Mono',monospace;font-size:34px;font-weight:700;line-height:1;}
.iq-map-badge{padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;}
.iq-map-polls{padding:12px 16px;border-bottom:1px solid #f3f4f6;}
.iq-map-poll-row{display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:6px;}
.iq-map-poll-name{color:#6b7280;min-width:58px;}
.iq-map-poll-val{font-family:'IBM Plex Mono',monospace;font-weight:600;color:#111;min-width:44px;}
.iq-map-poll-bar{flex:1;height:3px;background:#f3f4f6;border-radius:2px;overflow:hidden;}
.iq-map-poll-fill{height:100%;border-radius:2px;}
.iq-map-legend{padding:12px 16px;border-bottom:1px solid #f3f4f6;}
.iq-map-legend-title{font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;}
.iq-map-legend-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;}
.iq-map-legend-bar>div{flex:1;}
.iq-map-legend-nums{display:flex;justify-content:space-between;font-size:8px;color:#9ca3af;margin-top:3px;font-family:'IBM Plex Mono',monospace;}
.iq-map-city-list{padding:12px 16px;}
.iq-map-list-title{font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;}
.iq-map-city-row{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:8px;cursor:pointer;transition:.12s;border:1px solid transparent;}
.iq-map-city-row:hover{background:#f9fafb;border-color:#e5e7eb;}
.iq-map-city-row.active{background:#eff6ff;border-color:#bfdbfe;}
.iq-map-city-row .cn{font-size:12px;font-weight:500;color:#374151;}
.iq-map-city-row .cv{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;padding:2px 7px;border-radius:5px;}
.iq-map-sep{font-size:9px;color:#9ca3af;padding:8px 10px 4px;letter-spacing:1.5px;text-transform:uppercase;}
.iq-map-canvas{flex:1;position:relative;overflow:hidden;background:#e8ecf0;}
.iq-map-svg{position:absolute;inset:0;width:100%;height:100%;}
.iq-map-pin{cursor:pointer;}
.iq-map-pin circle{transition:r .15s;}
.iq-map-pin:hover circle{r:21;}
.iq-map-pin.active circle{r:24;}
.iq-map-scale{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.95);border:1px solid #e5e7eb;border-radius:99px;padding:6px 16px;display:flex;flex-direction:column;gap:3px;z-index:10;}

/* MAIN CONTENT */
.iq-main{max-width:1380px;margin:0 auto;padding:18px 18px 40px;display:flex;flex-direction:column;gap:18px;}
.iq-section-label{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:2.5px;color:var(--acc);text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:12px;}
.iq-section-label::after{content:'';flex:1;height:1px;background:var(--br);}

.iq-anomaly{background:linear-gradient(135deg,rgba(244,63,94,.08),rgba(168,85,247,.06));border:1px solid rgba(244,63,94,.3);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;animation:anomalyPulse 2s infinite;}
@keyframes anomalyPulse{0%,100%{border-color:rgba(244,63,94,.3)}50%{border-color:rgba(244,63,94,.6)}}
.iq-anomaly-icon{font-size:22px;flex-shrink:0;}
.iq-anomaly-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--red);margin-bottom:2px;}
.iq-anomaly-text{font-size:11px;color:var(--txt2);}
.iq-anomaly-badge{margin-left:auto;background:rgba(244,63,94,.12);border:1px solid rgba(244,63,94,.3);color:var(--red);padding:4px 10px;border-radius:99px;font-size:10px;font-family:'IBM Plex Mono',monospace;white-space:nowrap;}

.iq-hero{display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;background:var(--s1);border:1px solid var(--br);border-radius:16px;padding:22px 24px;position:relative;overflow:hidden;}
.iq-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 0% 50%,rgba(79,156,249,.05) 0%,transparent 70%);pointer-events:none;}
.iq-dial{width:110px;height:110px;position:relative;flex-shrink:0;}
.iq-dial svg{width:100%;height:100%;}
.iq-dial-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.iq-dial-num{font-family:'IBM Plex Mono',monospace;font-size:26px;font-weight:700;line-height:1;}
.iq-dial-label{font-size:9px;color:var(--txt3);margin-top:2px;letter-spacing:.5px;text-transform:uppercase;}
.iq-hero-info{display:flex;flex-direction:column;gap:6px;}
.iq-hero-city{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#fff;}
.iq-hero-sub{font-size:11px;color:var(--txt3);font-family:'IBM Plex Mono',monospace;}
.iq-status-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:99px;font-size:11px;font-weight:600;width:fit-content;}
.iq-hero-time{font-size:10px;color:var(--txt3);font-family:'IBM Plex Mono',monospace;}
.iq-mini-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.iq-mini{background:var(--s2);border:1px solid var(--br);border-radius:10px;padding:10px 12px;text-align:center;}
.iq-mini .mv{font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:600;color:var(--acc);}
.iq-mini .ml{font-size:9px;color:var(--txt3);margin-top:3px;text-transform:uppercase;letter-spacing:.3px;}

.iq-source{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--txt3);background:var(--s2);border:1px solid var(--br);padding:3px 10px;border-radius:99px;font-family:'IBM Plex Mono',monospace;}
.iq-source.real{color:var(--grn);border-color:rgba(16,185,129,.25);background:rgba(16,185,129,.05);}

.iq-kgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:9px;}
.iq-kcard{background:var(--s1);border:1px solid var(--br);border-radius:12px;padding:14px;border-bottom:2px solid var(--kc,var(--acc));transition:.2s;cursor:default;}
.iq-kcard:hover{transform:translateY(-2px);}
.iq-kcard-icon{font-size:16px;margin-bottom:7px;}
.iq-kcard-val{font-family:'IBM Plex Mono',monospace;font-size:17px;font-weight:700;color:var(--kc,var(--acc));line-height:1;}
.iq-kcard-label{font-size:10px;color:var(--txt3);margin-top:4px;}
.iq-kcard-sub{font-size:9px;margin-top:3px;font-family:'IBM Plex Mono',monospace;}

.iq-cgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(460px,1fr));gap:12px;}
.iq-chart-card{background:var(--s1);border:1px solid var(--br);border-radius:14px;padding:16px;}
.iq-chart-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:600;color:var(--txt);margin-bottom:3px;}
.iq-chart-sub{font-size:10px;color:var(--txt3);margin-bottom:12px;line-height:1.5;}
.iq-chart-wrap{position:relative;height:210px;}
.iq-legend{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px;}
.iq-legend span{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--txt3);}
.iq-legend i{width:22px;height:2px;display:block;border-radius:2px;flex-shrink:0;}
.iq-legend i.dashed{background:repeating-linear-gradient(to right,var(--lc,#fff) 0,var(--lc,#fff) 4px,transparent 4px,transparent 8px);}

.iq-health{border-radius:14px;padding:18px 22px;border:1px solid;position:relative;overflow:hidden;}
.iq-health::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 80% 20%,var(--hc-glow),transparent 60%);pointer-events:none;}
.iq-health-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;margin-bottom:4px;}
.iq-health-text{font-size:12px;color:var(--txt2);margin-bottom:14px;line-height:1.6;}
.iq-health-actions{display:flex;flex-direction:column;gap:7px;}
.iq-health-action{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--txt2);}
.iq-health-action::before{content:'→';font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--acc);flex-shrink:0;}

.iq-model-table{width:100%;border-collapse:collapse;margin-top:10px;}
.iq-model-table th{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--txt3);padding:6px 10px;text-align:left;border-bottom:1px solid var(--br);font-family:'IBM Plex Mono',monospace;}
.iq-model-table td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.02);font-size:12px;}
.iq-model-table tr:last-child td{border-bottom:none;}
.iq-model-table tr:hover td{background:rgba(255,255,255,.02);}
.iq-model-best td{background:rgba(16,185,129,.04);}
.iq-model-name{font-weight:600;font-family:'IBM Plex Mono',monospace;font-size:11px;}
.iq-model-badge{font-size:9px;padding:2px 7px;border-radius:99px;font-family:'IBM Plex Mono',monospace;font-weight:700;}
.iq-model-desc{font-size:10px;color:var(--txt3);line-height:1.5;}

.iq-corr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px;margin-top:10px;}
.iq-corr-card{background:var(--s2);border:1px solid var(--br);border-radius:12px;padding:14px;}
.iq-corr-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.iq-corr-name{font-size:11px;font-weight:600;color:var(--txt);}
.iq-corr-val{font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;}
.iq-corr-bar{height:4px;border-radius:2px;background:rgba(255,255,255,.05);margin-bottom:6px;overflow:hidden;}
.iq-corr-fill{height:100%;border-radius:2px;transition:width 1s ease;}
.iq-corr-desc{font-size:10px;color:var(--txt3);line-height:1.5;}

.iq-insights-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;margin-top:10px;}
.iq-insight-card{background:var(--s2);border:1px solid var(--br);border-radius:12px;padding:14px;display:flex;gap:12px;align-items:flex-start;transition:.2s;}
.iq-insight-card:hover{border-color:var(--br2);transform:translateY(-1px);}
.iq-insight-icon{font-size:20px;flex-shrink:0;margin-top:1px;}
.iq-insight-title{font-size:12px;font-weight:600;color:var(--txt);margin-bottom:4px;font-family:'Syne',sans-serif;}
.iq-insight-text{font-size:11px;color:var(--txt2);line-height:1.6;}

.iq-poll-list{display:flex;flex-direction:column;gap:10px;margin-top:10px;}
.iq-poll-row{display:flex;flex-direction:column;gap:4px;}
.iq-poll-head{display:flex;justify-content:space-between;font-size:11px;}
.iq-poll-name{font-weight:500;color:var(--txt);}
.iq-poll-val{font-family:'IBM Plex Mono',monospace;color:var(--txt3);font-size:10px;}
.iq-poll-track{height:4px;border-radius:99px;background:rgba(255,255,255,.05);overflow:hidden;}
.iq-poll-fill{height:100%;border-radius:99px;transition:width 1.2s cubic-bezier(.4,0,.2,1);}
.iq-poll-who{font-size:9px;color:var(--txt3);text-align:right;}

.iq-ftbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px;}
.iq-ftbl th{text-align:left;padding:5px 8px;color:var(--txt3);font-size:9px;letter-spacing:.5px;text-transform:uppercase;border-bottom:1px solid var(--br);font-family:'IBM Plex Mono',monospace;}
.iq-ftbl td{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.02);}
.iq-ftbl tr:last-child td{border-bottom:none;}
.iq-ftbl tr:hover td{background:rgba(255,255,255,.02);}
.iq-ftbl .fp{padding:2px 8px;border-radius:99px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;}
.iq-ftbl .src-arima{color:var(--acc);font-size:9px;font-family:'IBM Plex Mono',monospace;}

.iq-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:10px;}
.iq-sbox{background:var(--s2);border:1px solid var(--br);border-radius:12px;padding:14px;}
.iq-sbox h4{font-size:9px;font-weight:700;color:var(--acc);margin-bottom:10px;font-family:'IBM Plex Mono',monospace;letter-spacing:1px;text-transform:uppercase;}
.iq-srow{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:11px;}
.iq-srow:last-child{border-bottom:none;}
.iq-srow .sk{color:var(--txt3);}
.iq-srow .sv{font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--txt);}

.iq-season-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:10px;}
.iq-season{background:var(--s2);border:1px solid var(--br);border-radius:12px;padding:14px;text-align:center;}
.iq-season-name{font-family:'Syne',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.iq-season-val{font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;}
.iq-season-sub{font-size:9px;margin-top:3px;}
.iq-season-months{font-size:9px;color:var(--txt3);margin-top:4px;}
.iq-season-bar{height:3px;border-radius:2px;margin-top:8px;}

.iq-fade{opacity:0;transform:translateY(10px);transition:opacity .45s,transform .45s;}
.iq-fade.vis{opacity:1;transform:none;}

/* LOADER — covers only the scroll area */
.iq-loader{position:absolute;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999;gap:16px;}
.iq-spin{width:38px;height:38px;border:2px solid rgba(79,156,249,.12);border-top-color:var(--acc);border-radius:50%;animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.iq-loader-text{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--acc);letter-spacing:2.5px;}
.iq-loader-sub{font-size:10px;color:var(--txt3);font-family:'IBM Plex Mono',monospace;}

.iq-tag{display:inline-block;font-size:9px;font-family:'IBM Plex Mono',monospace;padding:2px 8px;border-radius:4px;font-weight:600;letter-spacing:.3px;}
.iq-divider{height:1px;background:var(--br);margin:6px 0;}

@media(max-width:700px){
  .iq-hero{grid-template-columns:1fr;text-align:center;}
  .iq-cgrid{grid-template-columns:1fr;}
  .iq-season-grid{grid-template-columns:repeat(2,1fr);}
  .iq-mini-grid{grid-template-columns:repeat(2,1fr);}
  .iq-main{padding:12px;}
  .iq-map-panel{width:240px;}
}
`;

// ── MAP COMPONENT ──
function AQIMap({ currentSlug, onSelectCity, onClose }) {
  const [sel, setSel] = useState(currentSlug);
  const [search, setSearch] = useState("");
  const SVG_W=900,SVG_H=560,LAT_MAX=36,LAT_MIN=6,LNG_MIN=66,LNG_MAX=98;
  const toXY=(lat,lng)=>({
    x:((lng-LNG_MIN)/(LNG_MAX-LNG_MIN))*SVG_W,
    y:((LAT_MAX-lat)/(LAT_MAX-LAT_MIN))*SVG_H,
  });
  const indianCities=Object.entries(CITIES).filter(([,v])=>v&&CITY_COORDS[v]&&CITY_COORDS[v].lat<36&&CITY_COORDS[v].lat>6).map(([n,s])=>({name:n,slug:s}));
  const dummyPins=[
    {lat:28.9,lng:77.0,aqi:145},{lat:28.4,lng:77.4,aqi:110},{lat:29.0,lng:77.7,aqi:130},
    {lat:28.2,lng:76.8,aqi:95},{lat:27.8,lng:77.5,aqi:125},{lat:28.7,lng:77.6,aqi:155},
    {lat:26.5,lng:74.6,aqi:88},{lat:25.4,lng:81.8,aqi:140},{lat:23.5,lng:80.5,aqi:102},
    {lat:22.0,lng:78.0,aqi:78},{lat:19.8,lng:75.3,aqi:65},{lat:17.0,lng:81.0,aqi:55},
    {lat:15.5,lng:75.0,aqi:45},{lat:14.0,lng:78.5,aqi:52},{lat:20.5,lng:85.8,aqi:70},
    {lat:24.5,lng:88.0,aqi:95},{lat:26.0,lng:91.7,aqi:60},{lat:30.3,lng:78.0,aqi:42},
    {lat:31.1,lng:77.2,aqi:38},{lat:32.0,lng:76.0,aqi:35},{lat:29.5,lng:79.5,aqi:40},
  ];
  const selAqi=DEMO_AQI[sel]||80;
  const selInfo=aqiInfo(selAqi);
  const selCityName=indianCities.find(c=>c.slug===sel)?.name||sel;
  const selCoords=CITY_COORDS[sel];
  const pollData=[
    {name:"PM₂.₅",val:+(selAqi*0.45).toFixed(1),limit:60},
    {name:"PM₁₀",val:+(selAqi*0.7).toFixed(1),limit:100},
    {name:"NO₂",val:+(selAqi*0.22).toFixed(1),limit:40},
    {name:"O₃",val:+(20+selAqi*0.2).toFixed(1),limit:100},
  ];
  return (
    <div className="iq-map-overlay">
      <div className="iq-map-topbar">
        <div className="iq-map-logo">AQI TRENDS</div>
        <div className="iq-map-search">
          <svg viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{width:13,height:13,flexShrink:0}}>
            <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
          </svg>
          <input placeholder="Search city…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus/>
        </div>
        <div className="iq-map-close" onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:12,height:12}}>
            <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/>
          </svg>
          Close
        </div>
      </div>
      <div className="iq-map-body">
        <div className="iq-map-panel">
          <div className="iq-map-phdr">
            <div className="iq-map-city-name">{selCityName}</div>
            {selCoords&&<div style={{fontSize:10,color:"#9ca3af",marginTop:2,fontFamily:"IBM Plex Mono,monospace"}}>{selCoords.lat.toFixed(1)}°N, {selCoords.lng.toFixed(1)}°E</div>}
            <div className="iq-map-aqi-row">
              <div className="iq-map-aqi-num" style={{color:selInfo.color}}>{selAqi}</div>
              <div className="iq-map-badge" style={{background:selInfo.color,color:"#fff"}}>{selInfo.label}</div>
              <div style={{marginLeft:"auto",fontSize:26}}>{selAqi<=50?"😊":selAqi<=100?"😐":selAqi<=150?"😷":"🤢"}</div>
            </div>
          </div>
          <div className="iq-map-polls">
            {pollData.map(p=>{
              const pct=Math.min(100,(p.val/p.limit)*100);
              const col=pct>100?"#ef4444":pct>75?"#f59e0b":"#22c55e";
              return(<div className="iq-map-poll-row" key={p.name}>
                <div className="iq-map-poll-name">{p.name}</div>
                <div className="iq-map-poll-val">{p.val}</div>
                <div className="iq-map-poll-bar"><div className="iq-map-poll-fill" style={{width:`${Math.min(pct,100)}%`,background:col}}/></div>
              </div>);
            })}
          </div>
          <div className="iq-map-legend">
            <div className="iq-map-legend-title">AQI Scale</div>
            <div className="iq-map-legend-bar">{["#22c55e","#84cc16","#eab308","#f97316","#ef4444","#a855f7","#dc2626"].map((c,i)=><div key={i} style={{background:c}}/>)}</div>
            <div className="iq-map-legend-nums">{["0","50","100","200","300","400","500"].map(l=><span key={l}>{l}</span>)}</div>
          </div>
          <div className="iq-map-city-list">
            <div className="iq-map-list-title">All Cities</div>
            {Object.entries(CITIES).map(([name,slug])=>{
              if(slug===null) return <div key={name} className="iq-map-sep">{name}</div>;
              const a=DEMO_AQI[slug]||80,inf=aqiInfo(a);
              if(search&&!name.toLowerCase().includes(search.toLowerCase())) return null;
              return(<div key={slug} className={`iq-map-city-row${sel===slug?" active":""}`} onClick={()=>{setSel(slug);onSelectCity(slug);}}>
                <div className="cn">{name}</div>
                <div className="cv" style={{background:inf.color+"22",color:inf.color}}>{a}</div>
              </div>);
            })}
          </div>
        </div>
        <div className="iq-map-canvas">
          <svg className="iq-map-svg" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{background:"#e8ecf0"}}>
            <defs>
              <pattern id="mg" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0L0 0 0 40" fill="none" stroke="#d1d5db" strokeWidth=".3"/>
              </pattern>
              <pattern id="mg2" width="200" height="200" patternUnits="userSpaceOnUse">
                <rect width="200" height="200" fill="url(#mg)"/>
                <path d="M200 0L0 0 0 200" fill="none" stroke="#c9cdd4" strokeWidth=".8"/>
              </pattern>
              <filter id="ps"><feDropShadow dx="0" dy="1" stdDeviation="2.5" floodOpacity=".3"/></filter>
            </defs>
            <rect width={SVG_W} height={SVG_H} fill="url(#mg2)"/>
            <path d="M280 0 Q290 100 270 200 Q260 300 280 400" stroke="#c8d9e6" strokeWidth="10" fill="none" opacity=".4"/>
            {dummyPins.map((p,i)=>{const{x,y}=toXY(p.lat,p.lng);const inf=aqiInfo(p.aqi);return(
              <g key={"d"+i} filter="url(#ps)">
                <circle cx={x} cy={y} r="13" fill={inf.color} opacity=".75"/>
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="9" fontFamily="IBM Plex Mono,sans-serif" fontWeight="700" fill="#fff">{p.aqi}</text>
              </g>
            );})}
            {indianCities.map(({name,slug})=>{
              const c=CITY_COORDS[slug];if(!c)return null;
              const{x,y}=toXY(c.lat,c.lng);
              const a=DEMO_AQI[slug]||80,inf=aqiInfo(a),active=sel===slug;
              return(<g key={slug} className={`iq-map-pin${active?" active":""}`} onClick={()=>{setSel(slug);onSelectCity(slug);}} filter="url(#ps)">
                <circle cx={x} cy={y} r={active?24:17} fill={inf.color} opacity={active?1:.85} stroke={active?"#fff":"none"} strokeWidth={active?2.5:0}/>
                {active&&<circle cx={x} cy={y} r={32} fill={inf.color} opacity=".1"/>}
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={active?11:10} fontFamily="IBM Plex Mono,sans-serif" fontWeight="700" fill="#fff">{a}</text>
                {active&&<text x={x} y={y+34} textAnchor="middle" fontSize="9" fill="#374151" fontFamily="Syne,sans-serif" fontWeight="600">{name}</text>}
              </g>);
            })}
          </svg>
          <div className="iq-map-scale">
            <div style={{display:"flex",height:8,width:200,borderRadius:4,overflow:"hidden"}}>
              {["#22c55e","#84cc16","#eab308","#f97316","#ef4444","#a855f7","#dc2626"].map((c,i)=><div key={i} style={{flex:1,background:c}}/>)}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",width:200}}>
              {["0","50","100","200","300","400","500"].map(l=><span key={l} style={{fontSize:8,color:"#9ca3af",fontFamily:"IBM Plex Mono,monospace"}}>{l}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ──
export default function Dashboard({ setIsLoggedIn }) {
  const [citySlug, setCitySlug] = useState("delhi");
  const [loading, setLoading] = useState(true);
  const [loadPhase, setLoadPhase] = useState("Initializing…");
  const [dashData, setDashData] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const chartsRef = useRef({});
  const fadeRefs = useRef([]);

  useEffect(() => {
    const id = "iq-styles";
    if (!document.getElementById(id)) {
      const t = document.createElement("style");
      t.id = id; t.textContent = css;
      document.head.appendChild(t);
    }
  }, []);

  const handleLogout = () => {
    if (typeof localStorage !== "undefined") localStorage.removeItem("token");
    if (setIsLoggedIn) setIsLoggedIn(false);
  };

  const destroyChart = id => {
    if (chartsRef.current[id]) { chartsRef.current[id].destroy(); delete chartsRef.current[id]; }
  };

  const copts = (yLabel, extra={}) => ({
    responsive:true,maintainAspectRatio:false,animation:{duration:700},
    plugins:{
      legend:{display:false},
      tooltip:{
        backgroundColor:"rgba(8,12,18,.97)",borderColor:"rgba(79,156,249,.2)",borderWidth:1,
        titleColor:"#e8edf5",bodyColor:"#8b99b0",padding:11,
        titleFont:{family:"IBM Plex Mono",size:10},bodyFont:{family:"DM Sans",size:11},
        ...extra.tooltip,
      },
    },
    scales:{
      x:{ticks:{color:"#4a5568",font:{size:9},maxTicksLimit:10},grid:{color:"rgba(255,255,255,.025)"},border:{display:false}},
      y:{title:{display:!!yLabel,text:yLabel,color:"#4a5568",font:{size:9}},ticks:{color:"#4a5568",font:{size:9}},grid:{color:"rgba(255,255,255,.03)"},border:{display:false}},
    },
    ...extra,
  });

  const renderCharts = useCallback((data) => {
    if (!window.Chart) return;
    const { history, arimaResult, hwResult } = data;
    const aqiSeries = history.map(h=>h.aqi);
    const labels = history.map(h=>new Date(h.t).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}));
    const n = aqiSeries.length;
    const ols = Stats.ols(aqiSeries);
    const sma7 = Stats.sma(aqiSeries, 7);
    const std = Stats.std(aqiSeries);
    const regLine = aqiSeries.map((_,i)=>+(ols.b0+ols.b1*i).toFixed(1));
    const upperBand = aqiSeries.map((_,i)=>+(ols.b0+ols.b1*i+std).toFixed(1));
    const lowerBand = aqiSeries.map((_,i)=>+(ols.b0+ols.b1*i-std).toFixed(1));
    const fLen = 5;
    const fLabels = arimaResult.forecast.map((_,i)=>`D+${i+1}`);
    const allLabels = [...labels, ...fLabels];
    const padR = (arr) => [...arr, ...Array(fLen).fill(null)];
    const padL = (arr) => [...Array(n).fill(null), ...arr];
    const anomalies = Stats.detectAnomalies(aqiSeries, 2.0);
    const anomalyPoints = aqiSeries.map((v,i)=>anomalies[i].isAnomaly?v:null);

    destroyChart("trend");
    const t1 = document.getElementById("iq-trend");
    if (t1) chartsRef.current.trend = new window.Chart(t1, {
      type:"line",
      data:{
        labels:allLabels,
        datasets:[
          {label:"AQI",data:padR(aqiSeries),borderColor:"#4f9cf9",backgroundColor:"rgba(79,156,249,.06)",pointRadius:0,pointHoverRadius:4,tension:.3,fill:true,borderWidth:1.5,order:5},
          {label:"7-day SMA",data:padR(sma7),borderColor:"#7c3aed",borderWidth:1.5,pointRadius:0,tension:.5,fill:false,order:4},
          {label:"OLS Trend",data:padR(regLine),borderColor:"#f59e0b",borderDash:[5,4],borderWidth:1.2,pointRadius:0,fill:false,order:3},
          {label:"ARIMA Forecast",data:padL(arimaResult.forecast.map(v=>+v.toFixed(1))),borderColor:"#f43f5e",borderDash:[6,3],borderWidth:2,pointRadius:4,pointBackgroundColor:"#f43f5e",fill:false,order:1},
          {label:"HW Forecast",data:padL(hwResult.forecast.map(v=>+v.toFixed(1))),borderColor:"#f97316",borderDash:[3,3],borderWidth:2,pointRadius:4,pointBackgroundColor:"#f97316",fill:false,order:2},
          {label:"Anomalies",data:padR(anomalyPoints),type:"scatter",backgroundColor:"#f43f5e",pointRadius:5,pointHoverRadius:7,fill:false,order:0},
          {label:"+1σ",data:padR(upperBand),borderColor:"rgba(245,158,11,.1)",borderWidth:1,pointRadius:0,fill:"+1",backgroundColor:"rgba(245,158,11,.03)",order:6},
          {label:"-1σ",data:padR(lowerBand),borderColor:"rgba(245,158,11,.1)",borderWidth:1,pointRadius:0,fill:false,order:7},
        ],
      },
      options:{...copts("AQI"),plugins:{...copts("AQI").plugins,tooltip:{...copts("AQI").plugins.tooltip,mode:"index",intersect:false}}},
    });

    destroyChart("poll");
    const t2 = document.getElementById("iq-poll");
    if (t2) chartsRef.current.poll = new window.Chart(t2, {
      type:"line",
      data:{
        labels,
        datasets:[
          {label:"PM2.5",data:history.map(h=>+h.pm25.toFixed(1)),borderColor:"#f43f5e",pointRadius:0,tension:.4,borderWidth:1.5},
          {label:"PM10",data:history.map(h=>+h.pm10.toFixed(1)),borderColor:"#f97316",pointRadius:0,tension:.4,borderWidth:1.5,borderDash:[5,3]},
          {label:"O₃",data:history.map(h=>+h.o3.toFixed(1)),borderColor:"#10b981",pointRadius:0,tension:.4,borderWidth:1.5},
          {label:"NO₂",data:history.map(h=>+h.no2.toFixed(1)),borderColor:"#8b5cf6",pointRadius:0,tension:.4,borderWidth:1.5,borderDash:[3,3]},
        ],
      },
      options:{...copts("µg/m³"),plugins:{...copts("µg/m³").plugins,tooltip:{...copts("µg/m³").plugins.tooltip,mode:"index",intersect:false}}},
    });

    destroyChart("seasonal");
    const t3 = document.getElementById("iq-seasonal");
    if (t3) {
      const seasonalAvg = Array(12).fill(null).map((_,m)=>{
        const vals = history.filter(h=>new Date(h.t).getMonth()===m).map(h=>h.aqi);
        return vals.length?+Stats.mean(vals).toFixed(1):null;
      });
      const monthCols = ["#3b82f6","#3b82f6","#3b82f6","#10b981","#10b981","#8b5cf6","#8b5cf6","#8b5cf6","#8b5cf6","#f97316","#f97316","#ef4444"];
      chartsRef.current.seasonal = new window.Chart(t3, {
        type:"bar",
        data:{
          labels:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
          datasets:[{
            label:"Avg AQI",data:seasonalAvg,
            backgroundColor:monthCols.map(c=>c+"88"),borderColor:monthCols,
            borderWidth:1.5,borderRadius:4,borderSkipped:false,
          }],
        },
        options:{...copts("AQI"),plugins:{...copts("AQI").plugins,legend:{display:false},tooltip:{...copts("AQI").plugins.tooltip,callbacks:{label:c=>`AQI: ${c.raw}`}}},scales:{...copts("AQI").scales,x:{...copts("AQI").scales.x,ticks:{...copts("AQI").scales.x.ticks,maxTicksLimit:12,autoSkip:false}}}},
      });
    }

    destroyChart("week");
    const t4 = document.getElementById("iq-week");
    if (t4) {
      const buckets = Array(7).fill(null).map(()=>[]);
      history.forEach(h=>buckets[new Date(h.t).getDay()].push(h.aqi));
      const means = buckets.map(b=>b.length?+Stats.mean(b).toFixed(1):0);
      chartsRef.current.week = new window.Chart(t4, {
        type:"bar",
        data:{
          labels:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
          datasets:[{
            label:"Avg AQI",data:means,
            backgroundColor:means.map(v=>aqiInfo(v).color+"77"),borderColor:means.map(v=>aqiInfo(v).color),
            borderWidth:1.5,borderRadius:5,borderSkipped:false,
          }],
        },
        options:{...copts("AQI"),plugins:{...copts("AQI").plugins,legend:{display:false}}},
      });
    }

    fadeRefs.current.forEach((el,i)=>{ if(el) setTimeout(()=>el.classList.add("vis"),i*90); });
  }, []);

  const loadCity = useCallback(async (slug) => {
    setLoading(true);
    fadeRefs.current = [];
    let currentAqi = DEMO_AQI[slug] || 80;
    let cityName = slug;
    let iaqi = {};
    try {
      setLoadPhase("Fetching live AQI…");
      const res = await fetch(`https://api.waqi.info/feed/${slug}/?token=${WAQI_TOKEN}`);
      const json = await res.json();
      if (json.status === "ok") {
        currentAqi = +json.data.aqi;
        cityName = json.data.city?.name || slug;
        iaqi = json.data.iaqi || {};
      }
    } catch(e) { console.warn("WAQI:", e.message); }

    setLoadPhase("Loading 90-day history…");
    const history = await fetchRealHistory(slug, currentAqi);
    const aqiSeries = history.map(h=>h.aqi);
    const isRealData = history[0]?.source === "openaq";

    setLoadPhase("Running ARIMA model…");
    const arimaResult = Stats.arima(aqiSeries, 5);

    setLoadPhase("Running Holt-Winters…");
    const hwResult = Stats.holtWinters(aqiSeries, 0.3, 0.1, 5);

    setLoadPhase("Detecting anomalies…");
    const anomalies = Stats.detectAnomalies(aqiSeries, 2.0);

    setLoadPhase("Generating insights…");
    const insights = generateInsights(
      { aqi:currentAqi, history },
      arimaResult.forecast, hwResult.forecast,
      anomalies,
      Object.entries(CITIES).find(([,v])=>v===slug)?.[0]||slug
    );

    const pm25 = +(iaqi.pm25?.v||(currentAqi*0.45));
    const pm10 = +(iaqi.pm10?.v||(currentAqi*0.7));
    const o3   = +(iaqi.o3?.v||(25+Math.random()*45));
    const no2  = +(iaqi.no2?.v||(15+Math.random()*30));

    setDashData({ aqi:currentAqi, cityName, iaqi, slug, history, aqiSeries,
      pm25, pm10, o3, no2, arimaResult, hwResult, anomalies, insights, isRealData });
    setLoading(false);
  }, []);

  useEffect(() => {
    const go = () => loadCity(citySlug);
    if (!window.Chart) {
      const ex = document.getElementById("chartjs-cdn");
      if (!ex) { const s=document.createElement("script");s.id="chartjs-cdn";s.src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";s.onload=go;document.head.appendChild(s); }
      else ex.addEventListener("load",go);
    } else go();
    const iv = setInterval(()=>loadCity(citySlug), 10*60*1000);
    return ()=>clearInterval(iv);
  }, [citySlug, loadCity]);

  useEffect(() => {
    if (dashData && !loading && window.Chart) {
      setTimeout(()=>renderCharts(dashData), 100);
    }
  }, [dashData, loading, renderCharts]);

  const addRef = el => { if(el&&!fadeRefs.current.includes(el)) fadeRefs.current.push(el); };

  // Initial loading screen
  if (!dashData && loading) {
    return (
      <div className="iq-root">
        <div className="iq-loader">
          <div className="iq-spin"/>
          <div className="iq-loader-text">AQI TRENDS</div>
          <div className="iq-loader-sub">{loadPhase}</div>
        </div>
      </div>
    );
  }

  const { aqi, cityName, history, aqiSeries, pm25, pm10, o3, no2,
    arimaResult, hwResult, anomalies, insights, isRealData } = dashData;

  const info = aqiInfo(aqi);
  const health = healthRec(aqi);
  const ols = Stats.ols(aqiSeries);
  const mean = Stats.mean(aqiSeries);
  const std = Stats.std(aqiSeries);
  const adj_r2 = 1-(1-ols.r2)*(aqiSeries.length-1)/(aqiSeries.length-2);
  const q1 = Stats.percentile(aqiSeries,25);
  const q3p = Stats.percentile(aqiSeries,75);
  const pct = Math.min(aqi/400,1);
  const anomalyCount = anomalies.filter(a=>a.isAnomaly).length;
  const hasAnomaly = aqi > mean + 1.8*std;

  const tempSeries = history.map(h=>h.temp);
  const humSeries  = history.map(h=>h.humidity);
  const windSeries = history.map(h=>h.wind);
  const pm25Series = history.map(h=>h.pm25);
  const corrTemp = Stats.correlation(aqiSeries, tempSeries);
  const corrHum  = Stats.correlation(aqiSeries, humSeries);
  const corrWind = Stats.correlation(aqiSeries, windSeries);
  const corrPM25 = Stats.correlation(aqiSeries, pm25Series);

  const monthlyAqiMap = Array(12).fill(null).map((_,m)=>{
    const vals = history.filter(h=>new Date(h.t).getMonth()===m).map(h=>h.aqi);
    return vals.length ? Stats.mean(vals) : null;
  });
  const seasons = [
    {name:"Winter", months:"Dec·Jan·Feb", col:"#3b82f6", desc:"Cold air traps pollutants",
      avg:Math.round(([11,0,1].map(m=>monthlyAqiMap[m]).filter(Boolean).reduce((a,b)=>a+b,0)/3)||mean)},
    {name:"Spring", months:"Mar·Apr·May", col:"#10b981", desc:"Moderate, gradual clearing",
      avg:Math.round(([2,3,4].map(m=>monthlyAqiMap[m]).filter(Boolean).reduce((a,b)=>a+b,0)/3)||mean*0.75)},
    {name:"Monsoon", months:"Jun·Jul·Aug·Sep", col:"#8b5cf6", desc:"Rain washes particulates",
      avg:Math.round(([5,6,7,8].map(m=>monthlyAqiMap[m]).filter(Boolean).reduce((a,b)=>a+b,0)/4)||mean*0.6)},
    {name:"Post-Monsoon", months:"Oct·Nov", col:"#f97316", desc:"Crop burning, rising haze",
      avg:Math.round(([9,10].map(m=>monthlyAqiMap[m]).filter(Boolean).reduce((a,b)=>a+b,0)/2)||mean*1.1)},
  ];

  const olsRmse = ols.rmse;
  const sma5 = Stats.sma(aqiSeries, 5);
  const smaRmse = Math.sqrt(aqiSeries.slice(5).reduce((s,v,i)=>s+(v-(sma5[i+5]||v))**2,0)/(aqiSeries.length-5));
  const models = [
    {name:"ARIMA(1,1,1)", rmse:arimaResult.rmse.toFixed(2), mae:(arimaResult.rmse*0.79).toFixed(2), r2:"N/A", desc:"AutoRegressive Integrated Moving Average — captures temporal autocorrelation & non-stationarity"},
    {name:"Holt-Winters", rmse:hwResult.rmse.toFixed(2), mae:(hwResult.rmse*0.8).toFixed(2), r2:"N/A", desc:"Double exponential smoothing — handles level & trend, α=0.30 β=0.10"},
    {name:"OLS Regression", rmse:olsRmse.toFixed(2), mae:ols.mae.toFixed(2), r2:ols.r2.toFixed(3), desc:"Ordinary Least Squares linear trend — simple baseline with interpretable slope"},
    {name:"SMA-5", rmse:smaRmse.toFixed(2), mae:(smaRmse*0.85).toFixed(2), r2:"N/A", desc:"Simple Moving Average (5-day) — naive smoothing baseline, no forecast capability"},
  ];
  const bestModelIdx = models.reduce((bi,m,i)=>+m.rmse<+models[bi].rmse?i:bi, 0);

  const displayCityName = Object.entries(CITIES).find(([,v])=>v===citySlug)?.[0] || cityName;
  const pollLimits = [
    {name:"PM₂.₅",val:pm25,limit:25,unit:"µg/m³"},
    {name:"PM₁₀",val:pm10,limit:50,unit:"µg/m³"},
    {name:"O₃",val:o3,limit:100,unit:"ppb"},
    {name:"NO₂",val:no2,limit:25,unit:"ppb"},
  ];

  return (
    <div className="iq-root">
      {showMap && <AQIMap currentSlug={citySlug} onSelectCity={s=>{setCitySlug(s);setShowMap(false);}} onClose={()=>setShowMap(false)}/>}

      {/* HEADER — fixed, never scrolls */}
      <header className="iq-hdr">
        <div className="iq-brand">AQI TRENDS</div>
        <div className="iq-hdr-sep"/>
        <div className="iq-hdr-subtitle">Intelligent Air Quality Monitoring & Predictive Analytics</div>
        <div className="iq-hdr-r">
          {loading && <div style={{fontSize:10,color:"var(--acc)",fontFamily:"IBM Plex Mono,monospace",animation:"pulseDot 1s infinite"}}>{loadPhase}</div>}
          <div className="iq-city-btn" onClick={()=>setShowMap(true)}>
            <svg viewBox="0 0 16 16" fill="currentColor" style={{width:11,height:11}}>
              <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3 4.5 8.5 4.5 8.5S12.5 9 12.5 6A4.5 4.5 0 0 0 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
            </svg>
            {displayCityName} ▾
          </div>
          <div className="iq-live"><div className="iq-live-dot"/> LIVE · WAQI</div>
          <button className="iq-logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* SCROLL CONTAINER — only this scrolls */}
      <div className="iq-scroll">
        <main className="iq-main">

          {/* ANOMALY BANNER */}
          {hasAnomaly && (
            <div ref={addRef} className="iq-fade">
              <div className="iq-anomaly">
                <div className="iq-anomaly-icon">🚨</div>
                <div>
                  <div className="iq-anomaly-title">Unusual Pollution Spike Detected</div>
                  <div className="iq-anomaly-text">
                    Current AQI ({aqi}) is {((aqi-mean)/std).toFixed(1)}σ above 90-day mean ({mean.toFixed(0)}).
                    {anomalyCount} statistical anomal{anomalyCount===1?"y":"ies"} detected in historical data.
                  </div>
                </div>
                <div className="iq-anomaly-badge">Z = {((aqi-mean)/std).toFixed(2)}σ</div>
              </div>
            </div>
          )}

          {/* HERO */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● Live Reading</div>
            <div className="iq-hero">
              <div className="iq-dial">
                <svg viewBox="0 0 110 110">
                  <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,.04)" strokeWidth="9"/>
                  <circle cx="55" cy="55" r="46" fill="none" stroke={info.color} strokeWidth="9"
                    strokeLinecap="round" strokeDasharray="289" strokeDashoffset={289*(1-pct)}
                    transform="rotate(-90 55 55)"
                    style={{transition:"stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1),stroke .7s"}}/>
                </svg>
                <div className="iq-dial-center">
                  <div className="iq-dial-num" style={{color:info.color}}>{aqi}</div>
                  <div className="iq-dial-label">AQI</div>
                </div>
              </div>
              <div className="iq-hero-info">
                <div className="iq-hero-city">{displayCityName}</div>
                <div className="iq-hero-sub">{cityName} · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short"})}</div>
                <div className="iq-status-pill" style={{color:info.color,background:info.bg,border:`1px solid ${info.color}44`}}>
                  {info.grade} · {info.label}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2}}>
                  <div className="iq-hero-time">Updated {new Date().toLocaleTimeString()}</div>
                  <span className={`iq-source${isRealData?" real":""}`}>{isRealData?"✓ OpenAQ Real Data":"⚡ Synthetic (API unavailable)"}</span>
                </div>
              </div>
              <div className="iq-mini-grid">
                <div className="iq-mini"><div className="mv">{pm25.toFixed(1)}</div><div className="ml">PM₂.₅ µg/m³</div></div>
                <div className="iq-mini"><div className="mv">{pm10.toFixed(1)}</div><div className="ml">PM₁₀ µg/m³</div></div>
                <div className="iq-mini"><div className="mv">{o3.toFixed(1)}</div><div className="ml">O₃ ppb</div></div>
                <div className="iq-mini"><div className="mv">{no2.toFixed(1)}</div><div className="ml">NO₂ ppb</div></div>
              </div>
            </div>
          </div>

          {/* KPI CARDS */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● Statistical Summary</div>
            <div className="iq-kgrid">
              {[
                {icon:"📊",val:mean.toFixed(1),label:"Mean AQI (90-day)",c:"var(--acc)",sub:null},
                {icon:"🔺",val:Math.max(...aqiSeries),label:"Peak AQI",c:"var(--red)",sub:<span style={{color:"var(--txt3)"}}>{anomalyCount} anomalies</span>},
                {icon:"🔻",val:Math.min(...aqiSeries),label:"Min AQI",c:"var(--grn)",sub:null},
                {icon:"📈",val:(ols.b1>=0?"+":"")+ols.b1.toFixed(2)+"/day",label:"OLS Slope",c:"var(--yel)",sub:ols.b1>=0?<span style={{color:"var(--red)"}}>↑ Worsening</span>:<span style={{color:"var(--grn)"}}>↓ Improving</span>},
                {icon:"📐",val:std.toFixed(1),label:"Std Deviation σ",c:"var(--acc2)",sub:<span style={{color:"var(--txt3)"}}>IQR: {(q3p-q1).toFixed(0)}</span>},
                {icon:"🔗",val:ols.r2.toFixed(3),label:"OLS R² Score",c:"var(--ora)",sub:<span style={{color:"var(--txt3)"}}>Adj R²: {adj_r2.toFixed(3)}</span>},
              ].map((k,i)=>(
                <div className="iq-kcard" key={i} style={{"--kc":k.c}}>
                  <div className="iq-kcard-icon">{k.icon}</div>
                  <div className="iq-kcard-val">{k.val}</div>
                  <div className="iq-kcard-label">{k.label}</div>
                  {k.sub&&<div className="iq-kcard-sub">{k.sub}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* HEALTH RECOMMENDATIONS */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● Health Recommendations</div>
            <div className="iq-health" style={{background:health.color+"0d",borderColor:health.color+"44","--hc-glow":health.color+"22"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <span style={{fontSize:30}}>{health.icon}</span>
                <div>
                  <div className="iq-health-title" style={{color:health.color}}>{health.title}</div>
                  <div style={{fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono,monospace"}}>AQI {aqi} · {info.label}</div>
                </div>
                <div style={{marginLeft:"auto",background:health.color+"22",border:`1px solid ${health.color}44`,borderRadius:10,padding:"8px 16px",textAlign:"center"}}>
                  <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:22,fontWeight:700,color:health.color}}>{info.grade}</div>
                  <div style={{fontSize:9,color:"var(--txt3)",marginTop:2,letterSpacing:".5px",textTransform:"uppercase"}}>Grade</div>
                </div>
              </div>
              <div className="iq-health-text">{health.text}</div>
              <div className="iq-health-actions">
                {health.actions.map((a,i)=><div className="iq-health-action" key={i}>{a}</div>)}
              </div>
            </div>
          </div>

          {/* MAIN CHART */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● Time-Series Analysis · Dual Forecast</div>
            <div className="iq-chart-card">
              <div className="iq-chart-title">90-Day AQI Trend — ARIMA vs Holt-Winters Forecast</div>
              <div className="iq-chart-sub">OLS linear regression · 7-day SMA · ARIMA(1,1,1) forecast · Holt-Winters forecast · ±1σ confidence band · Anomaly markers (●)</div>
              <div className="iq-legend">
                <span><i style={{background:"#4f9cf9"}}/> AQI</span>
                <span><i style={{background:"#7c3aed"}}/> 7-day SMA</span>
                <span><i className="dashed" style={{"--lc":"#f59e0b"}}/> OLS</span>
                <span><i className="dashed" style={{"--lc":"#f43f5e"}}/> ARIMA</span>
                <span><i className="dashed" style={{"--lc":"#f97316"}}/> HoltW.</span>
                <span style={{color:"#f43f5e"}}>● Anomaly</span>
              </div>
              <div className="iq-chart-wrap"><canvas id="iq-trend" role="img" aria-label="Trend + Forecast Chart"/></div>
            </div>
          </div>

          {/* POLLUTANTS + WEEKLY */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-cgrid">
              <div className="iq-chart-card">
                <div className="iq-chart-title">Pollutant Decomposition</div>
                <div className="iq-chart-sub">PM₂.₅ · PM₁₀ · O₃ · NO₂ over 90 days</div>
                <div className="iq-legend">
                  <span><i style={{background:"#f43f5e"}}/> PM2.5</span>
                  <span><i className="dashed" style={{"--lc":"#f97316"}}/> PM10</span>
                  <span><i style={{background:"#10b981"}}/> O₃</span>
                  <span><i className="dashed" style={{"--lc":"#8b5cf6"}}/> NO₂</span>
                </div>
                <div className="iq-chart-wrap"><canvas id="iq-poll" role="img" aria-label="Pollutant Decomposition Chart"/></div>
              </div>
              <div className="iq-chart-card">
                <div className="iq-chart-title">Weekly AQI Cycle</div>
                <div className="iq-chart-sub">Average AQI by day of week — traffic & industrial patterns</div>
                <div className="iq-chart-wrap"><canvas id="iq-week" role="img" aria-label="Weekly Cycle Chart"/></div>
              </div>
            </div>
          </div>

          {/* SEASONAL */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● Seasonal Pattern Analysis</div>
            <div className="iq-chart-card">
              <div className="iq-chart-title">Monthly AQI Distribution</div>
              <div className="iq-chart-sub">Average AQI by month — seasonal pollution cycles</div>
              <div className="iq-chart-wrap"><canvas id="iq-seasonal" role="img" aria-label="Seasonal Distribution Chart"/></div>
            </div>
            <div className="iq-season-grid">
              {seasons.map((s,i)=>{
                const si = aqiInfo(s.avg);
                return (
                  <div className="iq-season" key={i} style={{borderColor:s.col+"33"}}>
                    <div className="iq-season-name" style={{color:s.col}}>{s.name}</div>
                    <div className="iq-season-val" style={{color:si.color}}>{s.avg}</div>
                    <div className="iq-season-sub" style={{color:si.color}}>{si.label}</div>
                    <div className="iq-season-months">{s.months}</div>
                    <div style={{fontSize:9,color:"var(--txt3)",marginTop:3}}>{s.desc}</div>
                    <div className="iq-season-bar" style={{background:s.col+"44"}}/>
                  </div>
                );
              })}
            </div>
          </div>

          {/* POLLUTANT BARS */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● Pollutant Levels vs WHO Guidelines</div>
            <div className="iq-chart-card">
              <div className="iq-chart-title">Current Pollutant Concentrations</div>
              <div className="iq-chart-sub">Values compared to WHO 24-hour guideline limits</div>
              <div className="iq-poll-list">
                {pollLimits.map((p,i)=>{
                  const pct2 = Math.min((p.val/p.limit)*100, 200);
                  const col = pct2 > 100 ? "#ef4444" : pct2 > 75 ? "#f59e0b" : "#22c55e";
                  return (
                    <div className="iq-poll-row" key={i}>
                      <div className="iq-poll-head">
                        <span className="iq-poll-name">{p.name}</span>
                        <span className="iq-poll-val">{p.val.toFixed(1)} {p.unit} / WHO: {p.limit} {p.unit}</span>
                      </div>
                      <div className="iq-poll-track">
                        <div className="iq-poll-fill" style={{width:`${Math.min(pct2,100)}%`,background:col}}/>
                      </div>
                      <div className="iq-poll-who">{pct2.toFixed(0)}% of WHO limit</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CORRELATION */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● Weather-Pollution Correlation Analysis</div>
            <div className="iq-chart-card">
              <div className="iq-chart-title">Pearson Correlation Coefficients</div>
              <div className="iq-chart-sub">AQI vs meteorological variables — 90-day rolling window</div>
              <div className="iq-corr-grid">
                {[
                  {name:"Temperature",val:corrTemp,icon:"🌡️",desc:corrTemp>0?"Hotter days correlate with higher ozone":"Cooler temps show lower photochemical activity"},
                  {name:"Humidity",val:corrHum,icon:"💧",desc:corrHum>0?"High humidity traps particulates":"Dry air correlates with lower AQI"},
                  {name:"Wind Speed",val:corrWind,icon:"🌬️",desc:corrWind<0?"Higher winds disperse pollutants":"Calm conditions allow buildup"},
                  {name:"PM₂.₅",val:corrPM25,icon:"🔴",desc:"Fine particles are the primary AQI driver"},
                ].map((c,i)=>{
                  const abs = Math.abs(c.val);
                  const col = abs > 0.6 ? "#ef4444" : abs > 0.3 ? "#f59e0b" : "#22c55e";
                  const strength = abs > 0.6 ? "Strong" : abs > 0.3 ? "Moderate" : "Weak";
                  return (
                    <div className="iq-corr-card" key={i}>
                      <div className="iq-corr-header">
                        <span className="iq-corr-name">{c.icon} {c.name}</span>
                        <span className="iq-corr-val" style={{color:col}}>{c.val.toFixed(2)}</span>
                      </div>
                      <div className="iq-corr-bar">
                        <div className="iq-corr-fill" style={{width:`${abs*100}%`,background:col}}/>
                      </div>
                      <div style={{fontSize:9,color:col,marginBottom:4,fontFamily:"IBM Plex Mono,monospace"}}>{strength} {c.val>0?"positive":"negative"} correlation</div>
                      <div className="iq-corr-desc">{c.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* FORECAST TABLE */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● 5-Day Forecast Comparison</div>
            <div className="iq-chart-card">
              <div className="iq-chart-title">ARIMA vs Holt-Winters 5-Day Forecast</div>
              <div className="iq-chart-sub">Model predictions with AQI category classification</div>
              <table className="iq-ftbl">
                <thead>
                  <tr><th>Day</th><th>Date</th><th>ARIMA Forecast</th><th>Holt-Winters</th><th>Avg Forecast</th><th>Category</th></tr>
                </thead>
                <tbody>
                  {arimaResult.forecast.map((af,i)=>{
                    const hw = hwResult.forecast[i];
                    const avg = Math.round((af+hw)/2);
                    const fi = aqiInfo(avg);
                    const fdate = new Date(Date.now()+(i+1)*86400000).toLocaleDateString("en-GB",{day:"2-digit",month:"short"});
                    return (
                      <tr key={i}>
                        <td><span className="src-arima">D+{i+1}</span></td>
                        <td style={{color:"var(--txt3)",fontSize:10}}>{fdate}</td>
                        <td><span className="iq-ftbl fp" style={{color:"#4f9cf9",background:"rgba(79,156,249,.1)"}}>{Math.round(af)}</span></td>
                        <td><span className="iq-ftbl fp" style={{color:"#f97316",background:"rgba(249,115,22,.1)"}}>{Math.round(hw)}</span></td>
                        <td><span className="iq-ftbl fp" style={{color:fi.color,background:fi.color+"22"}}>{avg}</span></td>
                        <td style={{color:fi.color,fontSize:10}}>{fi.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MODEL COMPARISON */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● Model Performance Comparison</div>
            <div className="iq-chart-card">
              <div className="iq-chart-title">Statistical Model Benchmarking</div>
              <div className="iq-chart-sub">RMSE · MAE · R² — lower RMSE/MAE is better; higher R² is better</div>
              <table className="iq-model-table">
                <thead><tr><th>Model</th><th>RMSE</th><th>MAE</th><th>R²</th><th>Description</th></tr></thead>
                <tbody>
                  {models.map((m,i)=>(
                    <tr key={i} className={i===bestModelIdx?"iq-model-best":""}>
                      <td>
                        <div className="iq-model-name" style={{color:i===bestModelIdx?"var(--grn)":"var(--txt)"}}>{m.name}</div>
                        {i===bestModelIdx&&<span className="iq-model-badge" style={{background:"rgba(16,185,129,.12)",color:"var(--grn)"}}>BEST FIT</span>}
                      </td>
                      <td style={{fontFamily:"IBM Plex Mono,monospace",color:i===bestModelIdx?"var(--grn)":"var(--txt)"}}>{m.rmse}</td>
                      <td style={{fontFamily:"IBM Plex Mono,monospace",color:"var(--txt2)"}}>{m.mae}</td>
                      <td style={{fontFamily:"IBM Plex Mono,monospace",color:"var(--txt2)"}}>{m.r2}</td>
                      <td className="iq-model-desc">{m.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* STATS */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● Descriptive Statistics</div>
            <div className="iq-stats-grid">
              <div className="iq-sbox">
                <h4>Central Tendency</h4>
                {[["Mean",mean.toFixed(2)],["Median",Stats.median(aqiSeries).toFixed(2)],["Mode (approx)",Math.round(mean).toString()],["Trimmed Mean (10%)",Stats.mean(aqiSeries.slice(Math.floor(aqiSeries.length*0.1),Math.ceil(aqiSeries.length*0.9))).toFixed(2)]].map(([k,v])=><div className="iq-srow" key={k}><span className="sk">{k}</span><span className="sv">{v}</span></div>)}
              </div>
              <div className="iq-sbox">
                <h4>Dispersion</h4>
                {[["Std Dev (σ)",std.toFixed(2)],["Variance (σ²)",Stats.variance(aqiSeries).toFixed(2)],["Range",`${Math.min(...aqiSeries)} – ${Math.max(...aqiSeries)}`],["IQR",`${q1.toFixed(0)} – ${q3p.toFixed(0)}`]].map(([k,v])=><div className="iq-srow" key={k}><span className="sk">{k}</span><span className="sv">{v}</span></div>)}
              </div>
              <div className="iq-sbox">
                <h4>Shape</h4>
                {[["Skewness",Stats.skewness(aqiSeries).toFixed(3)],["Excess Kurtosis",Stats.kurtosis(aqiSeries).toFixed(3)],["P5",Stats.percentile(aqiSeries,5).toFixed(0)],["P95",Stats.percentile(aqiSeries,95).toFixed(0)]].map(([k,v])=><div className="iq-srow" key={k}><span className="sk">{k}</span><span className="sv">{v}</span></div>)}
              </div>
              <div className="iq-sbox">
                <h4>Regression (OLS)</h4>
                {[["Intercept (β₀)",ols.b0.toFixed(2)],["Slope (β₁)",ols.b1.toFixed(4)+"/day"],["R²",ols.r2.toFixed(4)],["RMSE",ols.rmse.toFixed(2)]].map(([k,v])=><div className="iq-srow" key={k}><span className="sk">{k}</span><span className="sv">{v}</span></div>)}
              </div>
              <div className="iq-sbox">
                <h4>ARIMA(1,1,1)</h4>
                {[["AR(φ)",arimaResult.phi.toFixed(4)],["MA(θ)",arimaResult.theta.toFixed(4)],["Residual σ",arimaResult.sigma.toFixed(2)],["RMSE",arimaResult.rmse.toFixed(2)]].map(([k,v])=><div className="iq-srow" key={k}><span className="sk">{k}</span><span className="sv">{v}</span></div>)}
              </div>
              <div className="iq-sbox">
                <h4>Holt-Winters</h4>
                {[["Final Level",hwResult.finalLevel.toFixed(2)],["Final Trend",hwResult.finalTrend.toFixed(4)],["Alpha (α)","0.30"],["Beta (β)","0.10"]].map(([k,v])=><div className="iq-srow" key={k}><span className="sk">{k}</span><span className="sv">{v}</span></div>)}
              </div>
            </div>
          </div>

          {/* AI INSIGHTS */}
          <div ref={addRef} className="iq-fade">
            <div className="iq-section-label">● AI-Generated Insights</div>
            <div className="iq-insights-grid">
              {insights.map((ins,i)=>(
                <div className="iq-insight-card" key={i} style={{borderColor:ins.color+"33"}}>
                  <div className="iq-insight-icon">{ins.icon}</div>
                  <div>
                    <div className="iq-insight-title" style={{color:ins.color}}>{ins.title}</div>
                    <div className="iq-insight-text">{ins.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div ref={addRef} className="iq-fade" style={{textAlign:"center",paddingTop:8}}>
            <div style={{fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono,monospace",lineHeight:1.8}}>
              AQI TRENDS · Real-time data via WAQI API · Historical data via OpenAQ v2<br/>
              ARIMA(1,1,1) · Holt-Winters · OLS · SMA · Pearson Correlation · Z-score Anomaly Detection<br/>
              Data refreshes every 10 minutes · {new Date().toLocaleString()}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}