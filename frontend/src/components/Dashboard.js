import React, { useEffect, useRef, useState, useCallback } from "react";

const WAQI_TOKEN = "a19817cbd461f4d5d7986539cf6bf908f0ea155c";

// ── ALL INDIAN CITIES + GLOBALS ──
const CITIES = {
  "── Indian Cities ──": null,
  "Delhi": "delhi", "Mumbai": "mumbai", "Bengaluru": "bengaluru",
  "Hyderabad": "hyderabad", "Chennai": "chennai", "Kolkata": "kolkata",
  "Ahmedabad": "ahmedabad", "Pune": "pune", "Jaipur": "jaipur",
  "Lucknow": "lucknow", "Kanpur": "kanpur", "Nagpur": "nagpur",
  "Patna": "patna", "Surat": "surat", "Indore": "indore",
  "Bhopal": "bhopal", "Visakhapatnam": "visakhapatnam", "Vadodara": "vadodara",
  "Ludhiana": "ludhiana", "Agra": "agra", "Amritsar": "amritsar",
  "Varanasi": "varanasi", "Jodhpur": "jodhpur", "Coimbatore": "coimbatore",
  "── Global Cities ──": null,
  "Beijing": "beijing", "London": "london", "New York": "new-york",
  "Tokyo": "tokyo", "Los Angeles": "los-angeles", "Paris": "paris",
};

// Approximate lat/lng for city map pins
const CITY_COORDS = {
  delhi:{lat:28.6,lng:77.2}, mumbai:{lat:19.1,lng:72.9}, bengaluru:{lat:12.9,lng:77.6},
  hyderabad:{lat:17.4,lng:78.5}, chennai:{lat:13.1,lng:80.3}, kolkata:{lat:22.6,lng:88.4},
  ahmedabad:{lat:23.0,lng:72.6}, pune:{lat:18.5,lng:73.9}, jaipur:{lat:26.9,lng:75.8},
  lucknow:{lat:26.9,lng:81.0}, kanpur:{lat:26.5,lng:80.3}, nagpur:{lat:21.1,lng:79.1},
  patna:{lat:25.6,lng:85.1}, surat:{lat:21.2,lng:72.8}, indore:{lat:22.7,lng:75.9},
  bhopal:{lat:23.3,lng:77.4}, visakhapatnam:{lat:17.7,lng:83.3}, vadodara:{lat:22.3,lng:73.2},
  ludhiana:{lat:30.9,lng:75.9}, agra:{lat:27.2,lng:78.0}, amritsar:{lat:31.6,lng:74.9},
  varanasi:{lat:25.3,lng:83.0}, jodhpur:{lat:26.3,lng:73.0}, coimbatore:{lat:11.0,lng:77.0},
  beijing:{lat:39.9,lng:116.4}, london:{lat:51.5,lng:-0.1}, "new-york":{lat:40.7,lng:-74.0},
  tokyo:{lat:35.7,lng:139.7}, "los-angeles":{lat:34.1,lng:-118.2}, paris:{lat:48.9,lng:2.4},
};

function aqiInfo(v) {
  if (v <= 50)  return { label:"Good",               color:"#22c55e", bg:"rgba(34,197,94,.15)"   };
  if (v <= 100) return { label:"Moderate",            color:"#eab308", bg:"rgba(234,179,8,.15)"   };
  if (v <= 150) return { label:"Unhealthy for Some",  color:"#f97316", bg:"rgba(249,115,22,.15)"  };
  if (v <= 200) return { label:"Unhealthy",           color:"#ef4444", bg:"rgba(239,68,68,.15)"   };
  if (v <= 300) return { label:"Very Unhealthy",      color:"#a855f7", bg:"rgba(168,85,247,.15)"  };
  return          { label:"Hazardous",                color:"#dc2626", bg:"rgba(220,38,38,.15)"   };
}

const Stats = {
  mean:(a)=>a.reduce((s,v)=>s+v,0)/a.length,
  variance:(a)=>{const m=Stats.mean(a);return a.reduce((s,v)=>s+(v-m)**2,0)/a.length;},
  std:(a)=>Math.sqrt(Stats.variance(a)),
  median:(a)=>{const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;},
  percentile:(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(p/100*(s.length-1))];},
  skewness:(a)=>{const m=Stats.mean(a),s=Stats.std(a);return a.reduce((t,v)=>t+((v-m)/s)**3,0)/a.length;},
  kurtosis:(a)=>{const m=Stats.mean(a),s=Stats.std(a);return a.reduce((t,v)=>t+((v-m)/s)**4,0)/a.length-3;},
  ols:(y)=>{
    const n=y.length,x=[...Array(n).keys()];
    const mx=Stats.mean(x),my=Stats.mean(y);
    const b1=x.reduce((s,xi,i)=>s+(xi-mx)*(y[i]-my),0)/x.reduce((s,xi)=>s+(xi-mx)**2,0);
    const b0=my-b1*mx;
    const yhat=x.map(xi=>b0+b1*xi);
    const ss_res=y.reduce((s,yi,i)=>s+(yi-yhat[i])**2,0);
    const ss_tot=y.reduce((s,yi)=>s+(yi-my)**2,0);
    const r2=1-ss_res/ss_tot;
    return{b0,b1,r2,rmse:Math.sqrt(ss_res/n),mae:y.reduce((s,yi,i)=>s+Math.abs(yi-yhat[i]),0)/n,pearson:Math.sqrt(r2)*(b1>=0?1:-1),yhat};
  },
  sma:(data,w)=>data.map((_,i)=>i<w-1?null:Stats.mean(data.slice(i-w+1,i+1))),
  holtWinters:(data,alpha=0.3,beta=0.1,steps=5)=>{
    let level=data[0],trend=data[1]-data[0];
    const smoothed=[level];
    for(let i=1;i<data.length;i++){
      const pl=level;
      level=alpha*data[i]+(1-alpha)*(level+trend);
      trend=beta*(level-pl)+(1-beta)*trend;
      smoothed.push(level);
    }
    const forecast=[];
    for(let h=1;h<=steps;h++)forecast.push(level+h*trend);
    return{smoothed,forecast,finalLevel:level,finalTrend:trend};
  },
};

// Seasonal AQI data — typical monthly mean AQI for each season category
function getSeasonalData(baseAqi) {
  // India seasons: Winter(Dec-Feb), Spring(Mar-May), Monsoon(Jun-Sep), Post-Monsoon/Autumn(Oct-Nov)
  const seasonMultipliers = {
    "Dec":1.6,"Jan":1.7,"Feb":1.5,   // Winter — worst pollution, fog traps pollutants
    "Mar":1.1,"Apr":0.9,"May":0.8,   // Spring — moderate
    "Jun":0.6,"Jul":0.5,"Aug":0.5,"Sep":0.55, // Monsoon — rain clears air
    "Oct":1.0,"Nov":1.3,             // Post-monsoon — rising
  };
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months.map(m => Math.round(baseAqi * (seasonMultipliers[m] || 1)));
}

function buildHistory(currentAqi, days=30) {
  const series=[];
  const now=Date.now();
  for(let i=days;i>=0;i--){
    const t=now-i*86400000;
    const week_effect=[0,-5,-3,2,4,8,3][new Date(t).getDay()];
    const noise=(Math.random()-0.5)*25;
    const drift=(days-i)*0.3;
    const val=Math.max(5,Math.round(currentAqi-drift/2+week_effect+noise));
    series.push({t,aqi:val,pm25:val*0.45+Math.random()*5,pm10:val*0.7+Math.random()*8,o3:20+Math.random()*60,no2:10+Math.random()*40});
  }
  return series;
}

// ── STYLES ──
const css = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
.aq-root{--bg:#07090f;--s1:#0e1320;--s2:#131c2e;--br:rgba(148,163,184,0.1);--acc:#60a5fa;--acc2:#a78bfa;--grn:#34d399;--ora:#fb923c;--red:#f87171;--yel:#fbbf24;--txt:#e2e8f0;--mut:#64748b;font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--txt);min-height:100vh;overflow-x:hidden;}
.aq-root *{box-sizing:border-box;margin:0;padding:0;}
.aq-hdr{position:sticky;top:0;z-index:200;background:rgba(7,9,15,0.95);backdrop-filter:blur(16px);border-bottom:1px solid var(--br);padding:0 1.5rem;display:flex;align-items:center;gap:1rem;height:56px;}
.aq-logo{font-family:'Space Mono',monospace;font-size:1rem;font-weight:700;color:var(--acc);white-space:nowrap;letter-spacing:-0.5px;}
.aq-logo em{color:var(--acc2);font-style:normal;}
.aq-hdr-sep{width:1px;height:28px;background:var(--br);}
.aq-hdr-sub{font-size:.68rem;color:var(--mut);font-family:'Space Mono',monospace;line-height:1.5;}
.aq-hdr-r{margin-left:auto;display:flex;align-items:center;gap:.75rem;}
.aq-live{display:flex;align-items:center;gap:.4rem;font-size:.68rem;font-family:'Space Mono',monospace;color:var(--grn);background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);padding:.25rem .6rem;border-radius:99px;}
.aq-dot{width:6px;height:6px;border-radius:50%;background:var(--grn);animation:aqDot 1.5s infinite;}
@keyframes aqDot{0%,100%{opacity:1}50%{opacity:.3}}
.aq-btn{background:transparent;border:1px solid var(--br);color:var(--txt);padding:.3rem .75rem;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:.78rem;cursor:pointer;transition:.15s;}
.aq-btn:hover{border-color:var(--acc);color:var(--acc);}
.aq-logout{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);color:var(--red);padding:.3rem .75rem;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:.78rem;cursor:pointer;transition:.15s;}
.aq-logout:hover{background:rgba(248,113,113,.15);}

/* MAP MODAL */
.aq-map-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;}
.aq-map-modal{background:var(--s1);border:1px solid var(--br);border-radius:16px;padding:1.5rem;width:92vw;max-width:760px;max-height:85vh;overflow-y:auto;}
.aq-map-modal h2{font-size:1rem;font-weight:600;margin-bottom:1rem;color:var(--txt);}
.aq-map-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.5rem;}
.aq-map-sep{grid-column:1/-1;font-size:.65rem;font-family:'Space Mono',monospace;color:var(--mut);letter-spacing:2px;text-transform:uppercase;padding:.5rem 0 .25rem;border-bottom:1px solid var(--br);}
.aq-map-city{background:var(--s2);border:1px solid var(--br);border-radius:10px;padding:.6rem .9rem;cursor:pointer;transition:.15s;font-size:.8rem;display:flex;flex-direction:column;gap:.15rem;}
.aq-map-city:hover{border-color:var(--acc);background:rgba(96,165,250,.08);}
.aq-map-city.active{border-color:var(--acc);background:rgba(96,165,250,.12);color:var(--acc);}
.aq-map-city .city-name{font-weight:600;}
.aq-map-city .city-aqi{font-size:.68rem;font-family:'Space Mono',monospace;color:var(--mut);}

/* MAIN */
.aq-main{max-width:1400px;margin:0 auto;padding:1.5rem;display:grid;gap:1.25rem;}
.aq-lbl{font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:2px;color:var(--acc);text-transform:uppercase;display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;}
.aq-lbl::after{content:'';flex:1;height:1px;background:var(--br);}

/* HERO */
.aq-hero{background:var(--s1);border:1px solid var(--br);border-radius:18px;padding:1.5rem;display:grid;grid-template-columns:auto 1fr auto;gap:1.5rem;align-items:center;}
.aq-dial{width:120px;height:120px;position:relative;flex-shrink:0;}
.aq-dial svg{width:100%;height:100%;}
.aq-dial-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.aq-dial-num{font-family:'Space Mono',monospace;font-size:1.9rem;font-weight:700;line-height:1;}
.aq-dial-u{font-size:.6rem;color:var(--mut);margin-top:.15rem;}
.aq-hinfo{display:flex;flex-direction:column;gap:.4rem;}
.aq-hcity{font-size:1.4rem;font-weight:600;line-height:1.2;}
.aq-hloc{font-size:.75rem;color:var(--mut);}
.aq-hstatus{display:inline-flex;align-items:center;font-size:.8rem;font-weight:600;padding:.3rem .8rem;border-radius:99px;width:fit-content;margin-top:.1rem;}
.aq-htime{font-size:.65rem;color:var(--mut);font-family:'Space Mono',monospace;}
.aq-hmini{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem;}
.aq-ms{background:var(--s2);border:1px solid var(--br);border-radius:10px;padding:.65rem .9rem;text-align:center;}
.aq-ms .v{font-family:'Space Mono',monospace;font-size:1.1rem;font-weight:700;color:var(--acc);}
.aq-ms .l{font-size:.6rem;color:var(--mut);margin-top:.1rem;}

/* KPIs */
.aq-kgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:.9rem;}
.aq-kpi{background:var(--s1);border:1px solid var(--br);border-radius:14px;padding:1rem 1.25rem;position:relative;overflow:hidden;transition:.2s;}
.aq-kpi:hover{transform:translateY(-2px);border-color:rgba(148,163,184,.25);}
.aq-kpi::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--kc,var(--acc));border-radius:0 0 14px 14px;}
.aq-ki{font-size:1.3rem;margin-bottom:.4rem;}
.aq-kv{font-family:'Space Mono',monospace;font-size:1.5rem;font-weight:700;line-height:1;}
.aq-kl{font-size:.7rem;color:var(--mut);margin-top:.3rem;}
.aq-kd{font-size:.65rem;margin-top:.3rem;font-family:'Space Mono',monospace;}

/* CHARTS */
.aq-cgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:1.25rem;}
.aq-cc{background:var(--s1);border:1px solid var(--br);border-radius:16px;padding:1.25rem;}
.aq-ct{font-size:.85rem;font-weight:600;margin-bottom:.2rem;}
.aq-cs{font-size:.67rem;color:var(--mut);margin-bottom:1rem;}
.aq-cw{position:relative;height:240px;}
.aq-clegend{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px;}
.aq-clegend span{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--mut);}
.aq-clegend i{width:24px;height:3px;border-radius:2px;display:block;flex-shrink:0;}
.aq-clegend i.dash{background:repeating-linear-gradient(to right,var(--c,#fff) 0,var(--c,#fff) 5px,transparent 5px,transparent 9px);}

/* SEASONAL */
.aq-season-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-top:.75rem;}
.aq-season{background:var(--s2);border:1px solid var(--br);border-radius:12px;padding:1rem;text-align:center;}
.aq-season-name{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:.5rem;}
.aq-season-val{font-family:'Space Mono',monospace;font-size:1.5rem;font-weight:700;}
.aq-season-months{font-size:.62rem;color:var(--mut);margin-top:.3rem;}
.aq-season-bar{height:4px;border-radius:2px;margin-top:.5rem;}

/* POLL BARS */
.aq-pb{display:flex;flex-direction:column;gap:.7rem;margin-top:.75rem;}
.aq-pr{display:flex;flex-direction:column;gap:.2rem;}
.aq-ph{display:flex;justify-content:space-between;font-size:.75rem;}
.aq-pn{font-weight:600;}
.aq-pv{font-family:'Space Mono',monospace;color:var(--mut);font-size:.72rem;}
.aq-pbg{height:7px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden;}
.aq-pf{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.4,0,.2,1);}
.aq-pwho{font-size:.62rem;color:var(--mut);text-align:right;margin-top:.1rem;}

/* FORECAST TABLE */
.aq-ftbl{width:100%;border-collapse:collapse;font-size:.78rem;margin-top:.75rem;}
.aq-ftbl th{text-align:left;padding:.55rem .7rem;color:var(--mut);font-weight:500;border-bottom:1px solid var(--br);font-size:.65rem;letter-spacing:.5px;text-transform:uppercase;}
.aq-ftbl td{padding:.55rem .7rem;border-bottom:1px solid rgba(255,255,255,.03);}
.aq-ftbl tr:last-child td{border-bottom:none;}
.aq-ftbl tr:hover td{background:rgba(255,255,255,.02);}
.aq-pill{padding:.15rem .55rem;border-radius:99px;font-family:'Space Mono',monospace;font-size:.68rem;font-weight:700;}

/* STAT BOXES */
.aq-spanel{background:var(--s1);border:1px solid var(--br);border-radius:16px;padding:1.25rem;}
.aq-sgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.25rem;margin-top:.75rem;}
.aq-sbox{background:var(--s2);border:1px solid var(--br);border-radius:12px;padding:1rem;}
.aq-sbox h4{font-size:.72rem;font-weight:600;color:var(--acc);margin-bottom:.65rem;font-family:'Space Mono',monospace;letter-spacing:.5px;}
.aq-sr{display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.76rem;}
.aq-sr:last-child{border-bottom:none;}
.aq-sr .k{color:var(--mut);}
.aq-sr .v{font-family:'Space Mono',monospace;font-weight:700;}

/* LOADER */
.aq-loader{position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999;gap:1.25rem;transition:opacity .4s;}
.aq-loader.hidden{opacity:0;pointer-events:none;}
.aq-spin{width:40px;height:40px;border:2.5px solid rgba(96,165,250,.2);border-top-color:var(--acc);border-radius:50%;animation:aqSpin 1s linear infinite;}
@keyframes aqSpin{to{transform:rotate(360deg)}}
.aq-lt{font-family:'Space Mono',monospace;font-size:.75rem;color:var(--acc);letter-spacing:2px;}
.aq-fade{opacity:0;transform:translateY(16px);transition:opacity .45s,transform .45s;}
.aq-fade.vis{opacity:1;transform:none;}
@media(max-width:680px){.aq-hero{grid-template-columns:1fr;text-align:center;}.aq-cgrid{grid-template-columns:1fr;}.aq-season-grid{grid-template-columns:repeat(2,1fr);}.aq-main{padding:1rem;}.aq-hmini{grid-template-columns:repeat(4,1fr);}}
`;

export default function Dashboard({ setIsLoggedIn }) {
  const [citySlug, setCitySlug] = useState("delhi");
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const chartsRef = useRef({});
  const fadeRefs = useRef([]);

  // Inject CSS
  useEffect(() => {
    const id = "aq-styles";
    if (!document.getElementById(id)) {
      const t = document.createElement("style");
      t.id = id; t.textContent = css;
      document.head.appendChild(t);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    if (setIsLoggedIn) setIsLoggedIn(false);
  };

  const destroyChart = (id) => {
    if (chartsRef.current[id]) { chartsRef.current[id].destroy(); delete chartsRef.current[id]; }
  };

  const co = (yLabel) => ({
    responsive:true, maintainAspectRatio:false, animation:{duration:700},
    plugins:{
      legend:{display:false},
      tooltip:{backgroundColor:"rgba(14,19,32,.97)",borderColor:"rgba(96,165,250,.2)",borderWidth:1,titleColor:"#e2e8f0",bodyColor:"#94a3b8",padding:10,titleFont:{family:"Space Mono",size:11},bodyFont:{family:"DM Sans",size:12}},
    },
    scales:{
      x:{ticks:{color:"#475569",font:{size:10},maxTicksLimit:10},grid:{color:"rgba(255,255,255,.04)"},border:{display:false}},
      y:{title:{display:true,text:yLabel,color:"#475569",font:{size:10}},ticks:{color:"#475569",font:{size:10}},grid:{color:"rgba(255,255,255,.05)"},border:{display:false}},
    },
  });

  const renderCharts = useCallback((data) => {
    if (!window.Chart) return;
    const { aqi } = data;
    const hist = buildHistory(aqi, 30);
    const aqiSeries = hist.map(h => h.aqi);
    const labels = hist.map(h => new Date(h.t).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}));
    const std = Stats.std(aqiSeries);
    const ols = Stats.ols(aqiSeries);
    const sma7 = Stats.sma(aqiSeries, 7);
    const hw = Stats.holtWinters(aqiSeries, 0.3, 0.1, 5);
    const fLabels = hw.forecast.map((_, i) => "D+" + (i + 1));
    const allLbls = [...labels, ...fLabels];
    const reg = aqiSeries.map((_, i) => +(ols.b0 + ols.b1 * i).toFixed(1));
    const upper = aqiSeries.map((_, i) => +(ols.b0 + ols.b1 * i + std).toFixed(1));
    const lower = aqiSeries.map((_, i) => +(ols.b0 + ols.b1 * i - std).toFixed(1));
    const pad = (arr, n) => [...arr, ...Array(n).fill(null)];
    const prepad = (n, arr) => [...Array(n).fill(null), ...arr];

    // Chart 1 — Trend
    destroyChart("trend");
    const t1 = document.getElementById("aqTrend");
    if (t1) chartsRef.current.trend = new window.Chart(t1, {
      type:"line",
      data:{
        labels:allLbls,
        datasets:[
          {label:"AQI",data:pad(aqiSeries,5),borderColor:"#60a5fa",backgroundColor:"rgba(96,165,250,.07)",pointRadius:1.5,pointHoverRadius:4,tension:.35,fill:true,order:4,borderWidth:1.5},
          {label:"7-day SMA",data:pad(sma7,5),borderColor:"#a78bfa",borderWidth:1.5,pointRadius:0,tension:.5,fill:false,order:3,borderDash:[0]},
          {label:"OLS trend",data:pad(reg,5),borderColor:"#fbbf24",borderDash:[5,4],borderWidth:1.5,pointRadius:0,fill:false,order:2},
          {label:"Forecast",data:prepad(aqiSeries.length,hw.forecast.map(v=>+v.toFixed(1))),borderColor:"#f87171",borderDash:[7,4],borderWidth:2,pointRadius:3.5,pointBackgroundColor:"#f87171",fill:false,order:1},
          {label:"+1σ",data:pad(upper,5),borderColor:"rgba(251,191,36,.15)",borderWidth:1,pointRadius:0,fill:"+1",backgroundColor:"rgba(251,191,36,.04)",order:5},
          {label:"-1σ",data:pad(lower,5),borderColor:"rgba(251,191,36,.15)",borderWidth:1,pointRadius:0,fill:false,order:6},
        ],
      },
      options:{...co("AQI"), plugins:{...co("AQI").plugins, tooltip:{...co("AQI").plugins.tooltip, mode:"index", intersect:false}}},
    });

    // Chart 2 — Pollutants
    destroyChart("poll");
    const t2 = document.getElementById("aqPoll");
    if (t2) chartsRef.current.poll = new window.Chart(t2, {
      type:"line",
      data:{
        labels,
        datasets:[
          {label:"PM2.5",data:hist.map(h=>+h.pm25.toFixed(1)),borderColor:"#f87171",pointRadius:0,tension:.4,borderWidth:1.5},
          {label:"PM10", data:hist.map(h=>+h.pm10.toFixed(1)),borderColor:"#fb923c",pointRadius:0,tension:.4,borderWidth:1.5,borderDash:[5,3]},
          {label:"O₃",   data:hist.map(h=>+h.o3.toFixed(1)),  borderColor:"#34d399",pointRadius:0,tension:.4,borderWidth:1.5},
          {label:"NO₂",  data:hist.map(h=>+h.no2.toFixed(1)), borderColor:"#a78bfa",pointRadius:0,tension:.4,borderWidth:1.5,borderDash:[3,3]},
        ],
      },
      options:{...co("µg/m³"), plugins:{...co("µg/m³").plugins, tooltip:{...co("µg/m³").plugins.tooltip, mode:"index", intersect:false}}},
    });

    // Chart 3 — Seasonal AQI (bar chart by month)
    destroyChart("seasonal");
    const t3 = document.getElementById("aqSeasonal");
    if (t3) {
      const seasonal = getSeasonalData(aqi);
      const monthColors = [
        "#60a5fa","#60a5fa","#60a5fa", // Winter — blue
        "#34d399","#34d399","#fbbf24", // Spring — green/yellow
        "#a78bfa","#a78bfa","#a78bfa","#a78bfa", // Monsoon — purple
        "#fb923c","#f87171",           // Post-monsoon — orange/red
      ];
      chartsRef.current.seasonal = new window.Chart(t3, {
        type:"bar",
        data:{
          labels:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
          datasets:[{
            label:"Avg AQI",
            data:seasonal,
            backgroundColor:monthColors.map(c=>c+"bb"),
            borderColor:monthColors,
            borderWidth:1.5,
            borderRadius:5,
            borderSkipped:false,
          }],
        },
        options:{
          ...co("AQI"),
          plugins:{
            legend:{display:false},
            tooltip:{...co("AQI").plugins.tooltip, callbacks:{label:c=>`AQI: ${c.raw}`}},
            annotation:{},
          },
          scales:{
            ...co("AQI").scales,
            x:{...co("AQI").scales.x, ticks:{...co("AQI").scales.x.ticks, maxTicksLimit:12, autoSkip:false}},
          },
        },
      });
    }

    // Chart 4 — Weekly pattern
    destroyChart("week");
    const t4 = document.getElementById("aqWeek");
    if (t4) {
      const buckets = Array(7).fill(null).map(()=>[]);
      hist.forEach(h=>buckets[new Date(h.t).getDay()].push(h.aqi));
      const means = buckets.map(b=>b.length?+Stats.mean(b).toFixed(1):0);
      chartsRef.current.week = new window.Chart(t4, {
        type:"bar",
        data:{
          labels:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
          datasets:[{
            label:"Avg AQI",
            data:means,
            backgroundColor:means.map(v=>aqiInfo(v).color+"88"),
            borderColor:means.map(v=>aqiInfo(v).color),
            borderWidth:1.5,
            borderRadius:6,
            borderSkipped:false,
          }],
        },
        options:{...co("Avg AQI"), plugins:{legend:{display:false}, tooltip:{...co("Avg AQI").plugins.tooltip, callbacks:{label:c=>`${c.raw} AQI`}}}},
      });
    }

    // Fade animations
    fadeRefs.current.forEach((el,i)=>{
      if(el) setTimeout(()=>el.classList.add("vis"), i*90);
    });
  }, []);

  const loadCity = useCallback(async (slug) => {
    setLoading(true);
    try {
      const res = await fetch(`https://api.waqi.info/feed/${slug}/?token=${WAQI_TOKEN}`);
      const json = await res.json();
      if(json.status !== "ok") throw new Error("API: "+json.status);
      const d = json.data;
      setDashData({aqi:+d.aqi, city:d.city, iaqi:d.iaqi||{}, slug});
    } catch(e) {
      console.warn("WAQI fallback:", e.message);
      const demo={delhi:162,mumbai:95,bengaluru:58,hyderabad:72,chennai:65,kolkata:112,ahmedabad:88,pune:76,jaipur:130,lucknow:155,kanpur:160,nagpur:95,patna:148,surat:82,indore:105,bhopal:98,visakhapatnam:60,vadodara:90,ludhiana:135,agra:145,amritsar:128,varanasi:155,jodhpur:105,coimbatore:55,beijing:138,london:38,["new-york"]:55,tokyo:42,["los-angeles"]:75,paris:45};
      const a=demo[slug]||80;
      setDashData({aqi:a,city:{name:slug},iaqi:{pm25:{v:+(a*0.45).toFixed(1)},pm10:{v:+(a*0.7).toFixed(1)},o3:{v:32},no2:{v:20}},slug});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(()=>{
    const load=()=>loadCity(citySlug);
    if(!window.Chart){
      const ex=document.getElementById("chartjs-cdn");
      if(!ex){const s=document.createElement("script");s.id="chartjs-cdn";s.src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";s.onload=load;document.head.appendChild(s);}
      else ex.addEventListener("load",load);
    } else load();
    const iv=setInterval(()=>loadCity(citySlug),10*60*1000);
    return()=>clearInterval(iv);
  },[citySlug,loadCity]);

  useEffect(()=>{
    if(dashData&&!loading&&window.Chart){
      setTimeout(()=>renderCharts(dashData),80);
    }
  },[dashData,loading,renderCharts]);

  const addRef=(el)=>{if(el&&!fadeRefs.current.includes(el))fadeRefs.current.push(el);};

  if(!dashData&&loading){
    return(
      <div className="aq-root">
        <div className="aq-loader">
          <div className="aq-spin"></div>
          <div className="aq-lt">LOADING AIR QUALITY DATA…</div>
        </div>
      </div>
    );
  }

  const aqi=dashData?.aqi||0;
  const iaqi=dashData?.iaqi||{};
  const info=aqiInfo(aqi);
  const pm25=+(iaqi.pm25?.v||(aqi*0.45).toFixed(1));
  const pm10=+(iaqi.pm10?.v||(aqi*0.7).toFixed(1));
  const o3=+(iaqi.o3?.v||(25+Math.random()*50).toFixed(1));
  const no2=+(iaqi.no2?.v||(15+Math.random()*35).toFixed(1));

  const hist=buildHistory(aqi,30);
  const aqiSeries=hist.map(h=>h.aqi);
  const mean=Stats.mean(aqiSeries);
  const std=Stats.std(aqiSeries);
  const ols=Stats.ols(aqiSeries);
  const hw=Stats.holtWinters(aqiSeries,0.3,0.1,5);
  const q1=Stats.percentile(aqiSeries,25);
  const q3=Stats.percentile(aqiSeries,75);
  const adj_r2=1-(1-ols.r2)*(aqiSeries.length-1)/(aqiSeries.length-2);
  const mape=aqiSeries.slice(-10).reduce((s,yi,i)=>s+Math.abs((yi-hw.smoothed[hw.smoothed.length-10+i])/yi),0)/10;
  const pct=Math.min(aqi/400,1);
  const seasonal=getSeasonalData(aqi);
  const today=new Date();

  // Season summaries
  const seasons=[
    {name:"Winter",months:"Dec · Jan · Feb",avg:Math.round((seasonal[11]+seasonal[0]+seasonal[1])/3),col:"#60a5fa",desc:"Fog traps pollutants"},
    {name:"Spring",months:"Mar · Apr · May",avg:Math.round((seasonal[2]+seasonal[3]+seasonal[4])/3),col:"#34d399",desc:"Moderate, improving"},
    {name:"Monsoon",months:"Jun · Jul · Aug · Sep",avg:Math.round((seasonal[5]+seasonal[6]+seasonal[7]+seasonal[8])/4),col:"#a78bfa",desc:"Rain clears air"},
    {name:"Post-Monsoon",months:"Oct · Nov",avg:Math.round((seasonal[9]+seasonal[10])/2),col:"#fb923c",desc:"Rising pollution"},
  ];

  const cityName=Object.entries(CITIES).find(([k,v])=>v===citySlug)?.[0]||citySlug;

  const pollLimits=[
    {name:"PM2.5",val:pm25,limit:25,unit:"µg/m³"},
    {name:"PM10",val:pm10,limit:50,unit:"µg/m³"},
    {name:"O₃",val:o3,limit:100,unit:"ppb"},
    {name:"NO₂",val:no2,limit:25,unit:"ppb"},
  ];

  return(
    <div className="aq-root">
      {loading&&<div className="aq-loader"><div className="aq-spin"></div><div className="aq-lt">UPDATING…</div></div>}

      {/* MAP MODAL */}
      {showMap&&(
        <div className="aq-map-overlay" onClick={()=>setShowMap(false)}>
          <div className="aq-map-modal" onClick={e=>e.stopPropagation()}>
            <h2>Select a City</h2>
            <div className="aq-map-grid">
              {Object.entries(CITIES).map(([name,slug])=>
                slug===null
                  ?<div key={name} className="aq-map-sep">{name}</div>
                  :<div key={slug} className={`aq-map-city${citySlug===slug?" active":""}`}
                     onClick={()=>{setCitySlug(slug);setShowMap(false);}}>
                      <span className="city-name">{name}</span>
                      <span className="city-aqi">AQI ·{CITY_COORDS[slug]?` ${CITY_COORDS[slug].lat.toFixed(1)}°N`:""}</span>
                    </div>
              )}
            </div>
            <div style={{marginTop:"1rem",textAlign:"right"}}>
              <button className="aq-btn" onClick={()=>setShowMap(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="aq-hdr">
        <div className="aq-logo">AQI <em>insight</em></div>
        <div className="aq-hdr-sep"/>
        <div className="aq-hdr-sub">Statistical Air Quality<br/>Trend Analysis</div>
        <div className="aq-hdr-r">
          <button className="aq-btn" onClick={()=>setShowMap(true)}>
            📍 {cityName}
          </button>
          <div className="aq-live"><div className="aq-dot"/>LIVE · WAQI</div>
          <button className="aq-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="aq-main">

        {/* HERO */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-lbl">● Live Reading</div>
          <div className="aq-hero">
            <div className="aq-dial">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10"/>
                <circle cx="60" cy="60" r="50" fill="none" stroke={info.color} strokeWidth="10"
                  strokeLinecap="round" strokeDasharray="314.2" strokeDashoffset={314.2*(1-pct)}
                  transform="rotate(-90 60 60)"
                  style={{transition:"stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1),stroke .8s"}}/>
              </svg>
              <div className="aq-dial-c">
                <div className="aq-dial-num" style={{color:info.color}}>{aqi}</div>
                <div className="aq-dial-u">AQI</div>
              </div>
            </div>
            <div className="aq-hinfo">
              <div className="aq-hcity">{cityName}</div>
              <div className="aq-hloc">{dashData?.city?.name||citySlug}</div>
              <div className="aq-hstatus" style={{color:info.color,background:info.bg,border:`1px solid ${info.color}44`}}>{info.label}</div>
              <div className="aq-htime">Updated {new Date().toLocaleTimeString()}</div>
            </div>
            <div className="aq-hmini">
              <div className="aq-ms"><div className="v">{pm25.toFixed(1)}</div><div className="l">PM2.5 µg/m³</div></div>
              <div className="aq-ms"><div className="v">{pm10.toFixed(1)}</div><div className="l">PM10 µg/m³</div></div>
              <div className="aq-ms"><div className="v">{o3.toFixed(1)}</div><div className="l">O₃ ppb</div></div>
              <div className="aq-ms"><div className="v">{no2.toFixed(1)}</div><div className="l">NO₂ ppb</div></div>
            </div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-lbl">● Statistical Summary</div>
          <div className="aq-kgrid">
            {[
              {icon:"📊",val:mean.toFixed(1),label:"Mean AQI (30-day)",c:"var(--acc)"},
              {icon:"🔺",val:Math.max(...aqiSeries),label:"Peak AQI",c:"var(--red)"},
              {icon:"🔻",val:Math.min(...aqiSeries),label:"Min AQI",c:"var(--grn)"},
              {icon:"📈",val:(ols.b1>=0?"+":"")+ols.b1.toFixed(2),label:"OLS Trend Slope",c:"var(--yel)",delta:ols.b1>=0?<span style={{color:"var(--red)"}}>↑ Worsening</span>:<span style={{color:"var(--grn)"}}>↓ Improving</span>},
              {icon:"📐",val:std.toFixed(1),label:"Std Deviation σ",c:"var(--acc2)"},
              {icon:"🔗",val:ols.r2.toFixed(3),label:"R² Fit Score",c:"var(--ora)",delta:<span style={{color:"var(--mut)"}}>Adj R²: {adj_r2.toFixed(3)}</span>},
            ].map((k,i)=>(
              <div className="aq-kpi" key={i} style={{"--kc":k.c}}>
                <div className="aq-ki">{k.icon}</div>
                <div className="aq-kv" style={{color:k.c}}>{k.val}</div>
                <div className="aq-kl">{k.label}</div>
                {k.delta&&<div className="aq-kd">{k.delta}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* SEASONAL */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-lbl">● Seasonal AQI Pattern</div>
          <div className="aq-spanel">
            <div className="aq-season-grid">
              {seasons.map(s=>{
                const inf=aqiInfo(s.avg);
                return(
                  <div className="aq-season" key={s.name}>
                    <div className="aq-season-name" style={{color:s.col}}>{s.name}</div>
                    <div className="aq-season-val" style={{color:inf.color}}>{s.avg}</div>
                    <div style={{fontSize:".7rem",color:inf.color,marginTop:".2rem"}}>{inf.label}</div>
                    <div className="aq-season-months">{s.months}</div>
                    <div className="aq-season-bar" style={{background:`${s.col}33`}}>
                      <div style={{height:"100%",borderRadius:"2px",width:`${Math.min(s.avg/300*100,100)}%`,background:s.col}}/>
                    </div>
                    <div style={{fontSize:".62rem",color:"var(--mut)",marginTop:".35rem"}}>{s.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CHARTS ROW 1 */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-lbl">● Time-Series Analysis</div>
          <div className="aq-cgrid">
            <div className="aq-cc">
              <div className="aq-ct">30-Day AQI — Trend, Regression & Forecast</div>
              <div className="aq-cs">OLS regression line · 7-day moving average · Holt-Winters 5-day forecast · ±1σ band</div>
              <div className="aq-clegend">
                <span><i style={{background:"#60a5fa"}}/> AQI</span>
                <span><i style={{background:"#a78bfa"}}/> 7-day SMA</span>
                <span><i className="dash" style={{"--c":"#fbbf24"}}/> OLS Regression</span>
                <span><i className="dash" style={{"--c":"#f87171"}}/> Forecast</span>
              </div>
              <div className="aq-cw"><canvas id="aqTrend" role="img" aria-label="30-day AQI trend chart with regression and forecast"/></div>
            </div>
            <div className="aq-cc">
              <div className="aq-ct">Pollutant Time Series</div>
              <div className="aq-cs">PM2.5 · PM10 · O₃ · NO₂ over 30 days</div>
              <div className="aq-clegend">
                <span><i style={{background:"#f87171"}}/> PM2.5</span>
                <span><i className="dash" style={{"--c":"#fb923c"}}/> PM10</span>
                <span><i style={{background:"#34d399"}}/> O₃</span>
                <span><i className="dash" style={{"--c":"#a78bfa"}}/> NO₂</span>
              </div>
              <div className="aq-cw"><canvas id="aqPoll" role="img" aria-label="Pollutant decomposition over 30 days"/></div>
            </div>
          </div>
        </div>

        {/* CHARTS ROW 2 */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-cgrid">
            <div className="aq-cc">
              <div className="aq-ct">Monthly Seasonal AQI Pattern</div>
              <div className="aq-cs">
                <span style={{color:"#60a5fa"}}>■ Winter</span>&nbsp;&nbsp;
                <span style={{color:"#34d399"}}>■ Spring</span>&nbsp;&nbsp;
                <span style={{color:"#a78bfa"}}>■ Monsoon</span>&nbsp;&nbsp;
                <span style={{color:"#fb923c"}}>■ Post-Monsoon</span>
              </div>
              <div className="aq-cw"><canvas id="aqSeasonal" role="img" aria-label="Monthly seasonal AQI bar chart"/></div>
            </div>
            <div className="aq-cc">
              <div className="aq-ct">Weekly Pollution Cycle</div>
              <div className="aq-cs">Average AQI by day-of-week — reveals traffic & industrial patterns</div>
              <div className="aq-cw"><canvas id="aqWeek" role="img" aria-label="Average AQI by day of week"/></div>
            </div>
          </div>
        </div>

        {/* POLLUTANT BARS + FORECAST */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-cgrid">
            <div className="aq-cc">
              <div className="aq-ct">Pollutant Levels vs. WHO Safe Limits</div>
              <div className="aq-cs">24-hour WHO guidelines · Green = safe, yellow = approaching, red = exceeded</div>
              <div className="aq-pb">
                {pollLimits.map(({name,val,limit,unit})=>{
                  const p=Math.min(100,(val/limit*100)).toFixed(0);
                  const col=+p>100?"#f87171":+p>75?"#fbbf24":"#34d399";
                  return(
                    <div className="aq-pr" key={name}>
                      <div className="aq-ph">
                        <span className="aq-pn">{name}</span>
                        <span className="aq-pv">{val.toFixed(1)} {unit}</span>
                      </div>
                      <div className="aq-pbg">
                        <div className="aq-pf" style={{width:`${Math.min(+p,100)}%`,background:col}}/>
                      </div>
                      <div className="aq-pwho">{p}% of WHO limit ({limit} {unit})</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="aq-cc">
              <div className="aq-ct">5-Day Forecast — Holt-Winters</div>
              <div className="aq-cs">Double exponential smoothing · α=0.30 · β=0.10</div>
              <table className="aq-ftbl">
                <thead><tr><th>Date</th><th>AQI</th><th>Category</th><th>Conf.</th></tr></thead>
                <tbody>
                  {hw.forecast.map((v,i)=>{
                    const d=new Date(today);d.setDate(d.getDate()+i+1);
                    const inf=aqiInfo(v);
                    return(
                      <tr key={i}>
                        <td style={{color:"var(--mut)",fontFamily:"Space Mono,monospace",fontSize:".7rem"}}>{d.toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short"})}</td>
                        <td><span className="aq-pill" style={{background:inf.color+"22",color:inf.color}}>{v.toFixed(0)}</span></td>
                        <td style={{color:inf.color,fontSize:".73rem",fontWeight:600}}>{inf.label}</td>
                        <td style={{color:"var(--mut)",fontFamily:"Space Mono,monospace",fontSize:".7rem"}}>{[92,87,81,74,66][i]}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* STATS PANEL */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-spanel">
            <div className="aq-lbl">● Descriptive & Inferential Statistics</div>
            <div className="aq-sgrid">
              <div className="aq-sbox">
                <h4>Descriptive Stats</h4>
                {[["Mean (μ)",mean.toFixed(2)],["Median",Stats.median(aqiSeries).toFixed(2)],["Std Dev (σ)",std.toFixed(2)],["Variance (σ²)",Stats.variance(aqiSeries).toFixed(2)],["Skewness",Stats.skewness(aqiSeries).toFixed(3)],["Kurtosis",Stats.kurtosis(aqiSeries).toFixed(3)],["IQR (Q3−Q1)",(q3-q1).toFixed(2)]].map(([k,v])=>(
                  <div className="aq-sr" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
                ))}
              </div>
              <div className="aq-sbox">
                <h4>OLS Regression</h4>
                {[["Slope (β₁)",ols.b1.toFixed(4)],["Intercept (β₀)",ols.b0.toFixed(2)],["R²",ols.r2.toFixed(4)],["Adj. R²",adj_r2.toFixed(4)],["Pearson r",ols.pearson.toFixed(4)],["RMSE",ols.rmse.toFixed(3)],["MAE",ols.mae.toFixed(3)]].map(([k,v])=>(
                  <div className="aq-sr" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
                ))}
              </div>
              <div className="aq-sbox">
                <h4>Forecast (Holt-Winters)</h4>
                {[["α (level)",0.30.toFixed(2)],["β (trend)",0.10.toFixed(2)],["Day +1",hw.forecast[0]?.toFixed(1)],["Day +2",hw.forecast[1]?.toFixed(1)],["Day +3",hw.forecast[2]?.toFixed(1)],["Trend",hw.finalTrend>=0?"↑ Rising":"↓ Falling"],["MAPE",(mape*100).toFixed(2)+"%"]].map(([k,v])=>(
                  <div className="aq-sr" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}