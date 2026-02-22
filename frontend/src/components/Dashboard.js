import React, { useEffect, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import "./Dashboard.css";

/* ⭐ IMPORTANT FIX FOR CHART.JS */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);
/* ⭐ END FIX */

function Dashboard({ setIsLoggedIn }) {

const [data,setData]=useState([]);
const [user,setUser]=useState(null);

/* ⭐ SAFE API URL (prevents crash if env missing) */
const API_URL=process.env.REACT_APP_API_URL || "http://localhost:5000";

useEffect(()=>{

const token=localStorage.getItem("token");
if(!token){ setIsLoggedIn(false); return; }

const headers={Authorization:`Bearer ${token}`};

axios.get(`${API_URL}/api/airdata`,{headers})
.then(r=>setData(Array.isArray(r.data)?r.data:[]))
.catch(()=>{ setData([]); });

axios.get(`${API_URL}/api/user`,{headers})
.then(r=>setUser(r.data))
.catch(()=>{});

},[API_URL,setIsLoggedIn]);

/* ===== CALCULATIONS ===== */

const avgAQI=data.length
? (data.reduce((s,i)=>s+(Number(i.aqi)||0),0)/data.length).toFixed(1)
:0;

const maxPM=data.length
? Math.max(...data.map(i=>Number(i.pm25)||0))
:0;

const years=data.map(i=>{
const d=new Date(i.date);
return isNaN(d)? "?" : d.getFullYear();
});

const aqi=data.map(i=>Number(i.aqi)||0);

function regression(y){

if(!y.length) return {slope:0,intercept:0};

const n=y.length;
const x=[...Array(n).keys()];

const sx=x.reduce((a,b)=>a+b,0);
const sy=y.reduce((a,b)=>a+b,0);
const sxy=x.reduce((a,b,i)=>a+b*y[i],0);
const sx2=x.reduce((a,b)=>a+b*b,0);

const denom=(n*sx2-sx*sx);

if(denom===0) return {slope:0,intercept:sy/n};

const slope=(n*sxy-sx*sy)/denom;
const intercept=(sy-slope*sx)/n;

return{slope,intercept};
}

const {slope,intercept}=regression(aqi);

const forecast=[1,2,3].map(i=>slope*(aqi.length+i)+intercept);

const trendChart={
labels:[...years,"+1","+2","+3"],
datasets:[
{
label:"AQI",
data:[...aqi,null,null,null],
borderColor:"#2563eb",
backgroundColor:"rgba(37,99,235,.15)",
tension:.4,
fill:true
},
{
label:"Forecast",
data:[...Array(aqi.length).fill(null),...forecast],
borderColor:"#ef4444",
borderDash:[6,6],
tension:.4
}
]
};

const logout=()=>{
localStorage.removeItem("token");
setIsLoggedIn(false);
};

return(

<div className="dash">

<header>

<h1>Air Quality Dashboard</h1>

{user &&
<div className="user">
{user.profilePic && <img src={user.profilePic} alt=""/>}
<span>{user.name || "User"}</span>
<button onClick={logout}>Logout</button>
</div>
}

</header>

<div className="cards">

<Card title="Average AQI" value={avgAQI}/>
<Card title="Max PM2.5" value={maxPM}/>
<Card title="Trend slope" value={slope.toFixed(2)}/>
<Card title="Records" value={data.length}/>

</div>

<div className="chartBox">
<h2>Time-Series Trend + Forecast</h2>

{data.length
? <Line data={trendChart}/>
: <p>No data available yet</p>
}

</div>

</div>
);
}

const Card=({title,value})=>(
<div className="card">
<h3>{title}</h3>
<h2>{value}</h2>
</div>
);

export default Dashboard;