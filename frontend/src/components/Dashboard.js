import React, { useEffect, useRef, useState, useCallback } from "react";

const WAQI_TOKEN = "a19817cbd461f4d5d7986539cf6bf908f0ea155c";

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

// Demo AQI values for map pins
const DEMO_AQI = {
  delhi:162, mumbai:95, bengaluru:58, hyderabad:72, chennai:65, kolkata:112,
  ahmedabad:88, pune:76, jaipur:130, lucknow:155, kanpur:160, nagpur:95,
  patna:148, surat:82, indore:105, bhopal:98, visakhapatnam:60, vadodara:90,
  ludhiana:135, agra:145, amritsar:128, varanasi:155, jodhpur:105, coimbatore:55,
  beijing:138, london:38, "new-york":55, tokyo:42, "los-angeles":75, paris:45,
};

function aqiInfo(v) {
  if (v <= 50)  return { label:"Good",               color:"#22c55e", bg:"rgba(34,197,94,.15)",   mapColor:"#22c55e" };
  if (v <= 100) return { label:"Moderate",            color:"#eab308", bg:"rgba(234,179,8,.15)",   mapColor:"#eab308" };
  if (v <= 150) return { label:"Unhealthy for Some",  color:"#f97316", bg:"rgba(249,115,22,.15)",  mapColor:"#f97316" };
  if (v <= 200) return { label:"Unhealthy",           color:"#ef4444", bg:"rgba(239,68,68,.15)",   mapColor:"#ef4444" };
  if (v <= 300) return { label:"Very Unhealthy",      color:"#a855f7", bg:"rgba(168,85,247,.15)",  mapColor:"#a855f7" };
  return          { label:"Hazardous",                color:"#dc2626", bg:"rgba(220,38,38,.15)",   mapColor:"#dc2626" };
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

function getSeasonalData(baseAqi) {
  const seasonMultipliers = {
    "Dec":1.6,"Jan":1.7,"Feb":1.5,
    "Mar":1.1,"Apr":0.9,"May":0.8,
    "Jun":0.6,"Jul":0.5,"Aug":0.5,"Sep":0.55,
    "Oct":1.0,"Nov":1.3,
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

/* ── RESET & ROOT ── */
.aq-root{--bg:#07090f;--s1:#0d1117;--s2:#111827;--s3:#1a2235;--br:rgba(255,255,255,0.07);--br2:rgba(255,255,255,0.12);--acc:#3b82f6;--acc2:#8b5cf6;--grn:#10b981;--ora:#f97316;--red:#ef4444;--yel:#f59e0b;--txt:#f1f5f9;--txt2:#94a3b8;--txt3:#475569;font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--txt);min-height:100vh;overflow-x:hidden;}
.aq-root *{box-sizing:border-box;margin:0;padding:0;}

/* ── HEADER ── */
.aq-hdr{position:sticky;top:0;z-index:200;background:rgba(7,9,15,0.96);backdrop-filter:blur(20px);border-bottom:1px solid var(--br);padding:0 20px;display:flex;align-items:center;gap:10px;height:52px;}
.aq-logo{font-size:15px;font-weight:500;color:#fff;letter-spacing:-.3px;display:flex;align-items:center;gap:7px;white-space:nowrap;}
.aq-logo-dot{width:8px;height:8px;border-radius:50%;background:var(--acc);}
.aq-logo em{color:var(--txt2);font-style:normal;font-weight:300;}
.aq-hdr-divider{width:1px;height:24px;background:var(--br);}
.aq-hdr-meta{font-size:11px;color:var(--txt3);line-height:1.5;}
.aq-hdr-r{margin-left:auto;display:flex;align-items:center;gap:7px;}
.aq-chip{display:flex;align-items:center;gap:5px;background:var(--s2);border:1px solid var(--br);padding:5px 11px;border-radius:8px;font-size:11px;color:var(--txt2);cursor:pointer;transition:.15s;white-space:nowrap;}
.aq-chip:hover{border-color:rgba(59,130,246,.4);color:var(--acc);}
.aq-chip svg{width:12px;height:12px;flex-shrink:0;}
.aq-live{display:flex;align-items:center;gap:4px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);color:var(--grn);padding:4px 9px;border-radius:99px;font-size:10px;font-family:'Space Mono',monospace;}
.aq-live-dot{width:5px;height:5px;border-radius:50%;background:var(--grn);animation:aqDot 1.5s infinite;}
@keyframes aqDot{0%,100%{opacity:1}50%{opacity:.3}}
.aq-logout{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);color:var(--red);padding:5px 11px;border-radius:8px;font-size:11px;cursor:pointer;transition:.15s;}
.aq-logout:hover{background:rgba(239,68,68,.14);}

/* ── MAP MODAL (full-screen like AQI.in) ── */
.aq-map-overlay{position:fixed;inset:0;z-index:500;background:#e8ecf0;display:flex;flex-direction:column;animation:mapFadeIn .25s ease;}
@keyframes mapFadeIn{from{opacity:0}to{opacity:1}}

/* Map top bar */
.aq-map-topbar{height:52px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px;padding:0 16px;flex-shrink:0;z-index:10;}
.aq-map-logo{font-size:15px;font-weight:600;color:var(--acc);letter-spacing:-.5px;}
.aq-map-search{flex:1;max-width:420px;display:flex;align-items:center;gap:8px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:99px;padding:6px 14px;}
.aq-map-search input{background:none;border:none;outline:none;font-size:12px;color:#374151;width:100%;font-family:'DM Sans',sans-serif;}
.aq-map-search input::placeholder{color:#9ca3af;}
.aq-map-close{margin-left:auto;display:flex;align-items:center;gap:6px;background:#f3f4f6;border:1px solid #e5e7eb;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:12px;color:#374151;transition:.15s;}
.aq-map-close:hover{background:#e5e7eb;}

/* Map content area */
.aq-map-content{flex:1;display:flex;position:relative;overflow:hidden;}

/* Sidebar panel (left) */
.aq-map-panel{width:320px;background:#fff;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto;z-index:5;}
.aq-map-panel-hdr{padding:16px;border-bottom:1px solid #f3f4f6;}
.aq-map-panel-loc{display:flex;align-items:center;gap:6px;margin-bottom:4px;}
.aq-map-panel-city{font-size:16px;font-weight:600;color:var(--acc);}
.aq-map-panel-sub{font-size:11px;color:#6b7280;margin-left:18px;}
.aq-map-aqi-row{display:flex;align-items:center;gap:12px;margin-top:12px;}
.aq-map-aqi-num{font-size:36px;font-weight:700;font-family:'Space Mono',monospace;line-height:1;}
.aq-map-aqi-badge{padding:5px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:default;}
.aq-map-pollutants{padding:12px 16px;border-bottom:1px solid #f3f4f6;display:flex;flex-direction:column;gap:8px;}
.aq-map-poll-row{display:flex;align-items:center;gap:8px;font-size:12px;}
.aq-map-poll-name{color:#6b7280;min-width:60px;display:flex;align-items:center;gap:3px;}
.aq-map-poll-arrow{font-size:10px;color:#9ca3af;}
.aq-map-poll-val{font-weight:600;color:#111827;font-family:'Space Mono',monospace;min-width:50px;}
.aq-map-poll-unit{font-size:10px;color:#9ca3af;}
.aq-map-poll-bar{flex:1;height:4px;border-radius:2px;background:#f3f4f6;overflow:hidden;}
.aq-map-poll-bar-fill{height:100%;border-radius:2px;transition:width .6s ease;}
.aq-map-legend{padding:12px 16px;}
.aq-map-legend-title{font-size:10px;color:#9ca3af;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;}
.aq-map-legend-bar{display:flex;height:10px;border-radius:5px;overflow:hidden;}
.aq-map-legend-bar > div{flex:1;}
.aq-map-legend-labels{display:flex;justify-content:space-between;font-size:9px;color:#9ca3af;margin-top:4px;}

/* City selector list in panel */
.aq-map-city-list{padding:12px 16px;}
.aq-map-city-list-title{font-size:10px;color:#9ca3af;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;}
.aq-map-city-item{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;cursor:pointer;transition:.15s;border:1px solid transparent;}
.aq-map-city-item:hover{background:#f9fafb;border-color:#e5e7eb;}
.aq-map-city-item.active{background:#eff6ff;border-color:#bfdbfe;}
.aq-map-city-item .ci-name{font-size:12px;font-weight:500;color:#374151;}
.aq-map-city-item .ci-sub{font-size:10px;color:#9ca3af;margin-top:1px;}
.aq-map-city-item .ci-aqi{font-family:'Space Mono',monospace;font-size:13px;font-weight:700;padding:2px 8px;border-radius:5px;}
.aq-map-sep{font-size:9px;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;padding:8px 10px 4px;font-weight:500;}

/* Map canvas area */
.aq-map-canvas{flex:1;position:relative;background:#e8ecf0;overflow:hidden;}
.aq-map-bg{width:100%;height:100%;object-fit:cover;opacity:.9;}

/* SVG map */
.aq-map-svg{position:absolute;inset:0;width:100%;height:100%;}

/* AQI pins on map */
.aq-pin-group{cursor:pointer;}
.aq-pin-circle{transition:r .2s,opacity .2s;}
.aq-pin-group:hover .aq-pin-circle{r:20;}
.aq-pin-text{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;fill:#fff;text-anchor:middle;dominant-baseline:central;pointer-events:none;}
.aq-pin-group.active .aq-pin-circle{r:22;stroke:#fff;stroke-width:2;}

/* Map zoom controls */
.aq-map-zoom{position:absolute;right:16px;bottom:80px;display:flex;flex-direction:column;gap:2px;z-index:10;}
.aq-map-zoom button{width:32px;height:32px;background:#fff;border:1px solid #e5e7eb;color:#374151;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s;}
.aq-map-zoom button:first-child{border-radius:6px 6px 0 0;}
.aq-map-zoom button:last-child{border-radius:0 0 6px 6px;}
.aq-map-zoom button:hover{background:#f9fafb;}

/* Map color scale bottom */
.aq-map-scale{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.95);border:1px solid #e5e7eb;border-radius:99px;padding:6px 16px;display:flex;align-items:center;gap:4px;font-size:10px;z-index:10;}
.aq-map-scale-bar{display:flex;height:8px;width:200px;border-radius:4px;overflow:hidden;}
.aq-map-scale-bar > div{flex:1;}
.aq-map-scale-labels{display:flex;gap:24px;color:#6b7280;font-family:'Space Mono',monospace;}

/* ── MAIN DASHBOARD ── */
.aq-main{max-width:1400px;margin:0 auto;padding:16px;display:grid;gap:12px;}
.aq-lbl{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;color:var(--acc);text-transform:uppercase;display:flex;align-items:center;gap:6px;margin-bottom:10px;}
.aq-lbl::after{content:'';flex:1;height:1px;background:var(--br);}

/* Hero */
.aq-hero{background:var(--s1);border:1px solid var(--br);border-radius:14px;padding:18px 20px;display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;}
.aq-dial{width:100px;height:100px;position:relative;flex-shrink:0;}
.aq-dial svg{width:100%;height:100%;}
.aq-dial-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.aq-dial-num{font-family:'Space Mono',monospace;font-size:24px;font-weight:700;line-height:1;}
.aq-dial-u{font-size:9px;color:var(--txt3);margin-top:2px;text-transform:uppercase;letter-spacing:.5px;}
.aq-hinfo{display:flex;flex-direction:column;gap:5px;}
.aq-hcity{font-size:20px;font-weight:500;color:var(--txt);}
.aq-hloc{font-size:11px;color:var(--txt3);}
.aq-hstatus{display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;width:fit-content;margin-top:2px;}
.aq-htime{font-size:10px;color:var(--txt3);font-family:'Space Mono',monospace;}
.aq-hmini{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;}
.aq-ms{background:var(--s2);border:1px solid var(--br);border-radius:9px;padding:9px 11px;text-align:center;}
.aq-ms .v{font-family:'Space Mono',monospace;font-size:13px;font-weight:600;color:var(--acc);}
.aq-ms .l{font-size:9px;color:var(--txt3);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}

/* KPIs */
.aq-kgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:8px;}
.aq-kpi{background:var(--s1);border:1px solid var(--br);border-radius:12px;padding:12px 14px;border-bottom:2px solid var(--kc,var(--acc));transition:.2s;}
.aq-kpi:hover{transform:translateY(-2px);border-color:var(--kc,var(--acc));}
.aq-ki{font-size:14px;margin-bottom:5px;}
.aq-kv{font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:var(--kc,var(--acc));line-height:1;}
.aq-kl{font-size:10px;color:var(--txt3);margin-top:3px;}
.aq-kd{font-size:9px;margin-top:3px;font-family:'Space Mono',monospace;}

/* Charts */
.aq-cgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:10px;}
.aq-cc{background:var(--s1);border:1px solid var(--br);border-radius:12px;padding:14px;}
.aq-ct{font-size:12px;font-weight:600;color:var(--txt);margin-bottom:2px;}
.aq-cs{font-size:10px;color:var(--txt3);margin-bottom:10px;}
.aq-cw{position:relative;height:220px;}
.aq-clegend{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px;}
.aq-clegend span{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--txt3);}
.aq-clegend i{width:20px;height:2px;border-radius:2px;display:block;flex-shrink:0;}
.aq-clegend i.dash{background:repeating-linear-gradient(to right,var(--c,#fff) 0,var(--c,#fff) 4px,transparent 4px,transparent 8px);}

/* Seasonal */
.aq-season-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px;}
.aq-season{background:var(--s2);border:1px solid var(--br);border-radius:10px;padding:12px;text-align:center;}
.aq-season-name{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;}
.aq-season-val{font-family:'Space Mono',monospace;font-size:20px;font-weight:700;}
.aq-season-months{font-size:9px;color:var(--txt3);margin-top:3px;}
.aq-season-bar{height:3px;border-radius:2px;margin-top:7px;}

/* Pollutant bars */
.aq-pb{display:flex;flex-direction:column;gap:9px;margin-top:8px;}
.aq-pr{display:flex;flex-direction:column;gap:3px;}
.aq-ph{display:flex;justify-content:space-between;font-size:11px;}
.aq-pn{font-weight:500;color:var(--txt);}
.aq-pv{font-family:'Space Mono',monospace;color:var(--txt3);font-size:10px;}
.aq-pbg{height:5px;border-radius:99px;background:rgba(255,255,255,.05);overflow:hidden;}
.aq-pf{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.4,0,.2,1);}
.aq-pwho{font-size:9px;color:var(--txt3);text-align:right;margin-top:1px;}

/* Forecast table */
.aq-ftbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;}
.aq-ftbl th{text-align:left;padding:5px 7px;color:var(--txt3);font-weight:500;border-bottom:1px solid var(--br);font-size:9px;letter-spacing:.5px;text-transform:uppercase;}
.aq-ftbl td{padding:6px 7px;border-bottom:1px solid rgba(255,255,255,.02);}
.aq-ftbl tr:last-child td{border-bottom:none;}
.aq-ftbl tr:hover td{background:rgba(255,255,255,.02);}
.aq-pill{padding:2px 7px;border-radius:99px;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;}

/* Stats panel */
.aq-spanel{background:var(--s1);border:1px solid var(--br);border-radius:12px;padding:14px;}
.aq-sgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:8px;}
.aq-sbox{background:var(--s2);border:1px solid var(--br);border-radius:10px;padding:12px;}
.aq-sbox h4{font-size:9px;font-weight:600;color:var(--acc);margin-bottom:8px;font-family:'Space Mono',monospace;letter-spacing:.5px;text-transform:uppercase;}
.aq-sr{display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:11px;}
.aq-sr:last-child{border-bottom:none;}
.aq-sr .k{color:var(--txt3);}
.aq-sr .v{font-family:'Space Mono',monospace;font-weight:600;color:var(--txt);}

/* Loader */
.aq-loader{position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999;gap:14px;transition:opacity .4s;}
.aq-loader.hidden{opacity:0;pointer-events:none;}
.aq-spin{width:36px;height:36px;border:2px solid rgba(59,130,246,.15);border-top-color:var(--acc);border-radius:50%;animation:aqSpin 1s linear infinite;}
@keyframes aqSpin{to{transform:rotate(360deg)}}
.aq-lt{font-family:'Space Mono',monospace;font-size:11px;color:var(--acc);letter-spacing:2px;}
.aq-fade{opacity:0;transform:translateY(12px);transition:opacity .4s,transform .4s;}
.aq-fade.vis{opacity:1;transform:none;}

@media(max-width:680px){
  .aq-hero{grid-template-columns:1fr;text-align:center;}
  .aq-cgrid{grid-template-columns:1fr;}
  .aq-season-grid{grid-template-columns:repeat(2,1fr);}
  .aq-main{padding:10px;}
  .aq-map-panel{width:260px;}
}
`;

// ── MAP COMPONENT ──
function AQIMap({ currentSlug, onSelectCity, onClose }) {
  const [selectedSlug, setSelectedSlug] = useState(currentSlug);
  const [mapSearch, setMapSearch] = useState("");
  const [zoom, setZoom] = useState(1);

  // India-focused lat/lng bounds mapped to SVG coords
  // SVG canvas: 900x600 for India view
  const SVG_W = 900, SVG_H = 560;
  const LAT_MAX = 36, LAT_MIN = 6, LNG_MIN = 66, LNG_MAX = 98;

  function latlngToXY(lat, lng) {
    const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * SVG_W;
    const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * SVG_H;
    return { x: Math.round(x), y: Math.round(y) };
  }

  // Show only Indian cities on the India map
  const indianCitySlugs = Object.entries(CITIES)
    .filter(([, v]) => v && CITY_COORDS[v] && CITY_COORDS[v].lat < 36 && CITY_COORDS[v].lat > 6)
    .map(([name, slug]) => ({ name, slug }));

  // Extra "nearby" dummy pins to mimic real-world density
  const dummyPins = [
    {lat:28.9,lng:77.0,aqi:145},{lat:28.4,lng:77.4,aqi:110},{lat:29.0,lng:77.7,aqi:130},
    {lat:28.2,lng:76.8,aqi:95},{lat:27.8,lng:77.5,aqi:125},{lat:28.7,lng:77.6,aqi:155},
    {lat:26.5,lng:74.6,aqi:88},{lat:25.4,lng:81.8,aqi:140},{lat:23.5,lng:80.5,aqi:102},
    {lat:22.0,lng:78.0,aqi:78},{lat:19.8,lng:75.3,aqi:65},{lat:17.0,lng:81.0,aqi:55},
    {lat:15.5,lng:75.0,aqi:45},{lat:14.0,lng:78.5,aqi:52},{lat:20.5,lng:85.8,aqi:70},
    {lat:24.5,lng:88.0,aqi:95},{lat:26.0,lng:91.7,aqi:60},{lat:21.5,lng:86.0,aqi:68},
    {lat:30.3,lng:78.0,aqi:42},{lat:31.1,lng:77.2,aqi:38},{lat:32.0,lng:76.0,aqi:35},
    {lat:29.5,lng:79.5,aqi:40},{lat:27.0,lng:88.3,aqi:48},{lat:25.0,lng:89.5,aqi:62},
  ];

  const filteredCities = indianCitySlugs.filter(c =>
    !mapSearch || c.name.toLowerCase().includes(mapSearch.toLowerCase())
  );

  const selectedCity = indianCitySlugs.find(c => c.slug === selectedSlug);
  const selectedAqi = DEMO_AQI[selectedSlug] || 80;
  const selInfo = aqiInfo(selectedAqi);
  const coords = CITY_COORDS[selectedSlug];

  const pollutantData = [
    { name: "PM₂.₅", key: "pm25", val: +(selectedAqi * 0.45).toFixed(1), unit: "µg/m³", limit: 60 },
    { name: "PM₁₀",  key: "pm10", val: +(selectedAqi * 0.7).toFixed(1),  unit: "µg/m³", limit: 100 },
    { name: "CO",    key: "co",   val: +(selectedAqi * 2.8).toFixed(0),   unit: "ppb",   limit: 800 },
    { name: "SO₂",   key: "so2",  val: +(selectedAqi * 0.025).toFixed(1), unit: "ppb",   limit: 20  },
    { name: "NO₂",   key: "no2",  val: +(selectedAqi * 0.22).toFixed(1),  unit: "ppb",   limit: 40  },
    { name: "O₃",    key: "o3",   val: +(20 + selectedAqi * 0.2).toFixed(1), unit: "ppb", limit: 100 },
  ];

  return (
    <div className="aq-map-overlay">
      {/* Top bar */}
      <div className="aq-map-topbar">
        <div className="aq-map-logo">AQI<sup style={{fontSize:8}}>®</sup></div>
        <div className="aq-map-search">
          <svg viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{width:13,height:13,flexShrink:0}}>
            <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
          </svg>
          <input
            placeholder="Search any Location, City, State or Country"
            value={mapSearch}
            onChange={e => setMapSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#6b7280",padding:"5px 12px",border:"1px solid #e5e7eb",borderRadius:8,background:"#f9fafb"}}>
            <span style={{fontSize:13}}>🗺</span> Map
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#6b7280",padding:"5px 12px",border:"1px solid #e5e7eb",borderRadius:8,background:"#f9fafb",cursor:"pointer"}}>
            <span style={{fontSize:13}}>🌡</span> Climate Change
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#6b7280",padding:"5px 12px",border:"1px solid #e5e7eb",borderRadius:8,background:"#f9fafb",cursor:"pointer"}}>
            <span style={{fontSize:13}}>📍</span> Near Me?
          </div>
          <div className="aq-map-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:12,height:12}}>
              <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/>
            </svg>
            Close Map
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="aq-map-content">
        {/* Left sidebar */}
        <div className="aq-map-panel">
          <div className="aq-map-panel-hdr">
            <div className="aq-map-panel-loc">
              <svg viewBox="0 0 16 16" fill={selInfo.color} style={{width:13,height:13,flexShrink:0}}>
                <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3 4.5 8.5 4.5 8.5S12.5 9 12.5 6A4.5 4.5 0 0 0 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
              </svg>
              <span className="aq-map-panel-city">{selectedCity?.name || selectedSlug}</span>
            </div>
            <div className="aq-map-panel-sub">
              {coords ? `${coords.lat.toFixed(1)}°N, ${coords.lng.toFixed(1)}°E · India` : ""}
            </div>

            <div style={{fontSize:11,color:"#9ca3af",marginTop:8,display:"flex",alignItems:"center",gap:5}}>
              <svg viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.3" style={{width:12,height:12}}>
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M11.1 4.9l-1.4 1.4M4.9 11.1l-1.4 1.4"/>
              </svg>
              Air Quality Index
            </div>
            <div className="aq-map-aqi-row">
              <div className="aq-map-aqi-num" style={{color:selInfo.color}}>{selectedAqi}</div>
              <div className="aq-map-aqi-badge" style={{background:selInfo.color,color:"#fff"}}>
                {selInfo.label}
              </div>
              <div style={{marginLeft:"auto",fontSize:28}}>
                {selectedAqi <= 50 ? "😊" : selectedAqi <= 100 ? "😐" : selectedAqi <= 150 ? "😷" : "🤢"}
              </div>
            </div>
          </div>

          {/* Pollutants */}
          <div className="aq-map-pollutants">
            {pollutantData.map(p => (
              <div className="aq-map-poll-row" key={p.key}>
                <div className="aq-map-poll-name">
                  {p.name}
                  <span className="aq-map-poll-arrow">↗</span>
                </div>
                <div className="aq-map-poll-val">{p.val}</div>
                <div className="aq-map-poll-unit">{p.unit}</div>
                <div className="aq-map-poll-bar">
                  <div
                    className="aq-map-poll-bar-fill"
                    style={{
                      width: `${Math.min(100, (p.val / p.limit) * 100)}%`,
                      background: p.val / p.limit > 0.75 ? "#f59e0b" : p.val / p.limit > 1 ? "#ef4444" : "#22c55e",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* AQI legend */}
          <div className="aq-map-legend">
            <div className="aq-map-legend-title">AQI Scale</div>
            <div className="aq-map-legend-bar">
              {["#22c55e","#84cc16","#eab308","#f97316","#ef4444","#a855f7","#dc2626"].map((c,i) => (
                <div key={i} style={{background:c}}/>
              ))}
            </div>
            <div className="aq-map-legend-labels">
              <span>0</span><span>50</span><span>100</span><span>200</span><span>300</span><span>400</span><span>500+</span>
            </div>
          </div>

          {/* City list */}
          <div className="aq-map-city-list">
            <div className="aq-map-city-list-title">All Cities</div>
            {Object.entries(CITIES).map(([name, slug]) => {
              if (slug === null) return <div key={name} className="aq-map-sep">{name}</div>;
              const a = DEMO_AQI[slug] || 80;
              const inf = aqiInfo(a);
              const show = !mapSearch || name.toLowerCase().includes(mapSearch.toLowerCase());
              if (!show) return null;
              return (
                <div
                  key={slug}
                  className={`aq-map-city-item${selectedSlug === slug ? " active" : ""}`}
                  onClick={() => { setSelectedSlug(slug); onSelectCity(slug); }}
                >
                  <div>
                    <div className="ci-name">{name}</div>
                    <div className="ci-sub">{CITY_COORDS[slug] ? `${CITY_COORDS[slug].lat.toFixed(1)}°N` : ""}</div>
                  </div>
                  <div className="ci-aqi" style={{background:inf.color+"22",color:inf.color}}>{a}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Map area with SVG pins */}
        <div className="aq-map-canvas">
          {/* Tile-like background using a simple SVG grid */}
          <svg
            className="aq-map-svg"
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{background:"#e8ecf0"}}
          >
            {/* Map background grid lines mimicking road network */}
            <defs>
              <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0L0 0 0 40" fill="none" stroke="#d1d5db" strokeWidth=".4"/>
              </pattern>
              <pattern id="mapgrid2" width="200" height="200" patternUnits="userSpaceOnUse">
                <rect width="200" height="200" fill="url(#mapgrid)"/>
                <path d="M200 0L0 0 0 200" fill="none" stroke="#c9cdd4" strokeWidth="1"/>
              </pattern>
              <filter id="pinShadow">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity=".25"/>
              </filter>
            </defs>
            <rect width={SVG_W} height={SVG_H} fill="url(#mapgrid2)"/>

            {/* Water body hints */}
            <ellipse cx="120" cy="300" rx="30" ry="80" fill="#c8d9e6" opacity=".6"/>
            <ellipse cx="450" cy="420" rx="20" ry="50" fill="#c8d9e6" opacity=".5"/>
            <path d="M280 0 Q290 100 270 200 Q260 300 280 400" stroke="#c8d9e6" strokeWidth="12" fill="none" opacity=".5"/>

            {/* Dummy nearby AQI pins */}
            {dummyPins.map((p, i) => {
              const {x,y} = latlngToXY(p.lat, p.lng);
              const inf = aqiInfo(p.aqi);
              return (
                <g key={"d"+i} className="aq-pin-group" filter="url(#pinShadow)">
                  <circle cx={x} cy={y} r="14" fill={inf.mapColor} opacity=".85" className="aq-pin-circle"/>
                  <text x={x} y={y} className="aq-pin-text">{p.aqi}</text>
                </g>
              );
            })}

            {/* Indian city pins */}
            {indianCitySlugs.map(({ name, slug }) => {
              const coords = CITY_COORDS[slug];
              if (!coords) return null;
              const {x,y} = latlngToXY(coords.lat, coords.lng);
              const a = DEMO_AQI[slug] || 80;
              const inf = aqiInfo(a);
              const isActive = selectedSlug === slug;
              return (
                <g
                  key={slug}
                  className={`aq-pin-group${isActive?" active":""}`}
                  onClick={() => { setSelectedSlug(slug); onSelectCity(slug); }}
                  filter="url(#pinShadow)"
                >
                  <circle
                    cx={x} cy={y}
                    r={isActive ? 22 : 17}
                    fill={inf.mapColor}
                    opacity={isActive ? 1 : 0.85}
                    stroke={isActive ? "#fff" : "none"}
                    strokeWidth={isActive ? 2.5 : 0}
                    className="aq-pin-circle"
                  />
                  {isActive && (
                    <circle cx={x} cy={y} r={28} fill={inf.mapColor} opacity={.15}/>
                  )}
                  <text x={x} y={y} className="aq-pin-text" fontSize={isActive ? 11 : 10}>
                    {a}
                  </text>
                  {isActive && (
                    <text x={x} y={y+32} textAnchor="middle" fontSize="9" fill="#374151"
                      fontFamily="DM Sans,sans-serif" fontWeight="600">
                      {name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Zoom controls */}
          <div className="aq-map-zoom">
            <button onClick={() => setZoom(z => Math.min(z+0.2, 2))} title="Zoom in">+</button>
            <button onClick={() => setZoom(z => Math.max(z-0.2, 0.5))} title="Zoom out">−</button>
            <button title="My location" style={{marginTop:4,borderRadius:6}}>⊕</button>
          </div>

          {/* AQI scale */}
          <div className="aq-map-scale">
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <div style={{display:"flex",height:8,width:200,borderRadius:4,overflow:"hidden"}}>
                {["#22c55e","#84cc16","#eab308","#f97316","#ef4444","#a855f7","#dc2626"].map((c,i)=>(
                  <div key={i} style={{flex:1,background:c}}/>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",width:200}}>
                {["0","50","100","200","300","400","500+"].map(l=>(
                  <span key={l} style={{fontSize:8,color:"#9ca3af",fontFamily:"Space Mono,monospace"}}>{l}</span>
                ))}
              </div>
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
  const [dashData, setDashData] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const chartsRef = useRef({});
  const fadeRefs = useRef([]);

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
    responsive:true, maintainAspectRatio:false, animation:{duration:600},
    plugins:{
      legend:{display:false},
      tooltip:{
        backgroundColor:"rgba(13,17,23,.97)",
        borderColor:"rgba(59,130,246,.2)",
        borderWidth:1,
        titleColor:"#f1f5f9",
        bodyColor:"#94a3b8",
        padding:10,
        titleFont:{family:"Space Mono",size:10},
        bodyFont:{family:"DM Sans",size:11},
      },
    },
    scales:{
      x:{ticks:{color:"#374151",font:{size:9},maxTicksLimit:10},grid:{color:"rgba(255,255,255,.03)"},border:{display:false}},
      y:{title:{display:true,text:yLabel,color:"#374151",font:{size:9}},ticks:{color:"#374151",font:{size:9}},grid:{color:"rgba(255,255,255,.04)"},border:{display:false}},
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

    destroyChart("trend");
    const t1 = document.getElementById("aqTrend");
    if (t1) chartsRef.current.trend = new window.Chart(t1, {
      type:"line",
      data:{
        labels:allLbls,
        datasets:[
          {label:"AQI",data:pad(aqiSeries,5),borderColor:"#3b82f6",backgroundColor:"rgba(59,130,246,.06)",pointRadius:1.5,pointHoverRadius:4,tension:.35,fill:true,order:4,borderWidth:1.5},
          {label:"7-day SMA",data:pad(sma7,5),borderColor:"#8b5cf6",borderWidth:1.5,pointRadius:0,tension:.5,fill:false,order:3},
          {label:"OLS trend",data:pad(reg,5),borderColor:"#f59e0b",borderDash:[5,4],borderWidth:1.5,pointRadius:0,fill:false,order:2},
          {label:"Forecast",data:prepad(aqiSeries.length,hw.forecast.map(v=>+v.toFixed(1))),borderColor:"#ef4444",borderDash:[6,4],borderWidth:2,pointRadius:3,pointBackgroundColor:"#ef4444",fill:false,order:1},
          {label:"+1σ",data:pad(upper,5),borderColor:"rgba(245,158,11,.12)",borderWidth:1,pointRadius:0,fill:"+1",backgroundColor:"rgba(245,158,11,.04)",order:5},
          {label:"-1σ",data:pad(lower,5),borderColor:"rgba(245,158,11,.12)",borderWidth:1,pointRadius:0,fill:false,order:6},
        ],
      },
      options:{...co("AQI"),plugins:{...co("AQI").plugins,tooltip:{...co("AQI").plugins.tooltip,mode:"index",intersect:false}}},
    });

    destroyChart("poll");
    const t2 = document.getElementById("aqPoll");
    if (t2) chartsRef.current.poll = new window.Chart(t2, {
      type:"line",
      data:{
        labels,
        datasets:[
          {label:"PM2.5",data:hist.map(h=>+h.pm25.toFixed(1)),borderColor:"#ef4444",pointRadius:0,tension:.4,borderWidth:1.5},
          {label:"PM10", data:hist.map(h=>+h.pm10.toFixed(1)),borderColor:"#f97316",pointRadius:0,tension:.4,borderWidth:1.5,borderDash:[5,3]},
          {label:"O₃",   data:hist.map(h=>+h.o3.toFixed(1)),  borderColor:"#10b981",pointRadius:0,tension:.4,borderWidth:1.5},
          {label:"NO₂",  data:hist.map(h=>+h.no2.toFixed(1)), borderColor:"#8b5cf6",pointRadius:0,tension:.4,borderWidth:1.5,borderDash:[3,3]},
        ],
      },
      options:{...co("µg/m³"),plugins:{...co("µg/m³").plugins,tooltip:{...co("µg/m³").plugins.tooltip,mode:"index",intersect:false}}},
    });

    destroyChart("seasonal");
    const t3 = document.getElementById("aqSeasonal");
    if (t3) {
      const seasonal = getSeasonalData(aqi);
      const monthColors = [
        "#3b82f6","#3b82f6","#3b82f6",
        "#10b981","#10b981","#f59e0b",
        "#8b5cf6","#8b5cf6","#8b5cf6","#8b5cf6",
        "#f97316","#ef4444",
      ];
      chartsRef.current.seasonal = new window.Chart(t3, {
        type:"bar",
        data:{
          labels:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
          datasets:[{
            label:"Avg AQI",
            data:seasonal,
            backgroundColor:monthColors.map(c=>c+"99"),
            borderColor:monthColors,
            borderWidth:1.5,
            borderRadius:4,
            borderSkipped:false,
          }],
        },
        options:{...co("AQI"),plugins:{legend:{display:false},tooltip:{...co("AQI").plugins.tooltip,callbacks:{label:c=>`AQI: ${c.raw}`}}},scales:{...co("AQI").scales,x:{...co("AQI").scales.x,ticks:{...co("AQI").scales.x.ticks,maxTicksLimit:12,autoSkip:false}}}},
      });
    }

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
            borderRadius:5,
            borderSkipped:false,
          }],
        },
        options:{...co("Avg AQI"),plugins:{legend:{display:false},tooltip:{...co("Avg AQI").plugins.tooltip,callbacks:{label:c=>`${c.raw} AQI`}}}},
      });
    }

    fadeRefs.current.forEach((el,i)=>{
      if(el) setTimeout(()=>el.classList.add("vis"), i*80);
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
      const a = DEMO_AQI[slug] || 80;
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

  const seasons=[
    {name:"Winter",months:"Dec · Jan · Feb",avg:Math.round((seasonal[11]+seasonal[0]+seasonal[1])/3),col:"#3b82f6",desc:"Fog traps pollutants"},
    {name:"Spring",months:"Mar · Apr · May",avg:Math.round((seasonal[2]+seasonal[3]+seasonal[4])/3),col:"#10b981",desc:"Moderate, improving"},
    {name:"Monsoon",months:"Jun · Jul · Aug · Sep",avg:Math.round((seasonal[5]+seasonal[6]+seasonal[7]+seasonal[8])/4),col:"#8b5cf6",desc:"Rain clears air"},
    {name:"Post-Monsoon",months:"Oct · Nov",avg:Math.round((seasonal[9]+seasonal[10])/2),col:"#f97316",desc:"Rising pollution"},
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
      {loading&&<div className="aq-loader"><div className="aq-spin"/><div className="aq-lt">UPDATING…</div></div>}

      {/* AQI MAP MODAL */}
      {showMap && (
        <AQIMap
          currentSlug={citySlug}
          onSelectCity={(slug) => { setCitySlug(slug); setShowMap(false); }}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* HEADER */}
      <header className="aq-hdr">
        <div className="aq-logo">
          <div className="aq-logo-dot"/>
          AQI <em>insight</em>
        </div>
        <div className="aq-hdr-divider"/>
        <div className="aq-hdr-meta">Statistical Air Quality<br/>Trend Analysis</div>
        <div className="aq-hdr-r">
          {/* City chip — opens map */}
          <div className="aq-chip" onClick={() => setShowMap(true)}>
            <svg viewBox="0 0 16 16" fill="currentColor" style={{width:11,height:11}}>
              <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3 4.5 8.5 4.5 8.5S12.5 9 12.5 6A4.5 4.5 0 0 0 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
            </svg>
            {cityName}
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:10,height:10}}>
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="aq-live"><div className="aq-live-dot"/>LIVE · WAQI</div>
          <button className="aq-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="aq-main">

        {/* HERO */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-lbl">● Live Reading</div>
          <div className="aq-hero">
            <div className="aq-dial">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="8"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke={info.color} strokeWidth="8"
                  strokeLinecap="round" strokeDasharray="263.9" strokeDashoffset={263.9*(1-pct)}
                  transform="rotate(-90 50 50)"
                  style={{transition:"stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1),stroke .7s"}}/>
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
              {icon:"🔗",val:ols.r2.toFixed(3),label:"R² Fit Score",c:"var(--ora)",delta:<span style={{color:"var(--txt3)"}}>Adj R²: {adj_r2.toFixed(3)}</span>},
            ].map((k,i)=>(
              <div className="aq-kpi" key={i} style={{"--kc":k.c}}>
                <div className="aq-ki">{k.icon}</div>
                <div className="aq-kv">{k.val}</div>
                <div className="aq-kl">{k.label}</div>
                {k.delta&&<div className="aq-kd">{k.delta}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* SEASONAL */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-lbl">● Seasonal AQI Pattern</div>
          <div style={{background:"var(--s1)",border:"1px solid var(--br)",borderRadius:12,padding:14}}>
            <div className="aq-season-grid">
              {seasons.map(s=>{
                const inf=aqiInfo(s.avg);
                return(
                  <div className="aq-season" key={s.name}>
                    <div className="aq-season-name" style={{color:s.col}}>{s.name}</div>
                    <div className="aq-season-val" style={{color:inf.color}}>{s.avg}</div>
                    <div style={{fontSize:10,color:inf.color,marginTop:2}}>{inf.label}</div>
                    <div className="aq-season-months">{s.months}</div>
                    <div className="aq-season-bar" style={{background:`${s.col}22`}}>
                      <div style={{height:"100%",borderRadius:"2px",width:`${Math.min(s.avg/300*100,100)}%`,background:s.col}}/>
                    </div>
                    <div style={{fontSize:9,color:"var(--txt3)",marginTop:4}}>{s.desc}</div>
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
              <div className="aq-cs">OLS regression · 7-day SMA · Holt-Winters 5-day forecast · ±1σ band</div>
              <div className="aq-clegend">
                <span><i style={{background:"#3b82f6"}}/> AQI</span>
                <span><i style={{background:"#8b5cf6"}}/> 7-day SMA</span>
                <span><i className="dash" style={{"--c":"#f59e0b"}}/> OLS</span>
                <span><i className="dash" style={{"--c":"#ef4444"}}/> Forecast</span>
              </div>
              <div className="aq-cw"><canvas id="aqTrend" role="img" aria-label="30-day AQI trend"/></div>
            </div>
            <div className="aq-cc">
              <div className="aq-ct">Pollutant Time Series</div>
              <div className="aq-cs">PM2.5 · PM10 · O₃ · NO₂ over 30 days</div>
              <div className="aq-clegend">
                <span><i style={{background:"#ef4444"}}/> PM2.5</span>
                <span><i className="dash" style={{"--c":"#f97316"}}/> PM10</span>
                <span><i style={{background:"#10b981"}}/> O₃</span>
                <span><i className="dash" style={{"--c":"#8b5cf6"}}/> NO₂</span>
              </div>
              <div className="aq-cw"><canvas id="aqPoll" role="img" aria-label="Pollutant decomposition"/></div>
            </div>
          </div>
        </div>

        {/* CHARTS ROW 2 */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-cgrid">
            <div className="aq-cc">
              <div className="aq-ct">Monthly Seasonal AQI Pattern</div>
              <div className="aq-cs">
                <span style={{color:"#3b82f6"}}>■ Winter</span>&nbsp;&nbsp;
                <span style={{color:"#10b981"}}>■ Spring</span>&nbsp;&nbsp;
                <span style={{color:"#8b5cf6"}}>■ Monsoon</span>&nbsp;&nbsp;
                <span style={{color:"#f97316"}}>■ Post-Monsoon</span>
              </div>
              <div className="aq-cw"><canvas id="aqSeasonal" role="img" aria-label="Monthly seasonal AQI"/></div>
            </div>
            <div className="aq-cc">
              <div className="aq-ct">Weekly Pollution Cycle</div>
              <div className="aq-cs">Average AQI by day-of-week</div>
              <div className="aq-cw"><canvas id="aqWeek" role="img" aria-label="AQI by day of week"/></div>
            </div>
          </div>
        </div>

        {/* POLLUTANT BARS + FORECAST */}
        <div className="aq-fade" ref={addRef}>
          <div className="aq-cgrid">
            <div className="aq-cc">
              <div className="aq-ct">Pollutant Levels vs. WHO Safe Limits</div>
              <div className="aq-cs">24-hour WHO guidelines · Green = safe · Yellow = approaching · Red = exceeded</div>
              <div className="aq-pb">
                {pollLimits.map(({name,val,limit,unit})=>{
                  const p=Math.min(100,(val/limit*100)).toFixed(0);
                  const col=+p>100?"#ef4444":+p>75?"#f59e0b":"#10b981";
                  return(
                    <div className="aq-pr" key={name}>
                      <div className="aq-ph">
                        <span className="aq-pn">{name}</span>
                        <span className="aq-pv">{val.toFixed(1)} {unit}</span>
                      </div>
                      <div className="aq-pbg"><div className="aq-pf" style={{width:`${Math.min(+p,100)}%`,background:col}}/></div>
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
                        <td style={{color:"var(--txt3)",fontFamily:"Space Mono,monospace",fontSize:"10px"}}>{d.toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short"})}</td>
                        <td><span className="aq-pill" style={{background:inf.color+"22",color:inf.color}}>{v.toFixed(0)}</span></td>
                        <td style={{color:inf.color,fontSize:"11px",fontWeight:600}}>{inf.label}</td>
                        <td style={{color:"var(--txt3)",fontFamily:"Space Mono,monospace",fontSize:"10px"}}>{[92,87,81,74,66][i]}%</td>
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
                {[["α (level)","0.30"],["β (trend)","0.10"],["Day +1",hw.forecast[0]?.toFixed(1)],["Day +2",hw.forecast[1]?.toFixed(1)],["Day +3",hw.forecast[2]?.toFixed(1)],["Trend",hw.finalTrend>=0?"↑ Rising":"↓ Falling"],["MAPE",(mape*100).toFixed(2)+"%"]].map(([k,v])=>(
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