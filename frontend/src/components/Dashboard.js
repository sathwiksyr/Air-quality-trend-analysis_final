import React, { useEffect, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import "./Dashboard.css";

function Dashboard({ setIsLoggedIn }) {

const [data,setData]=useState([]);
const [user,setUser]=useState(null);
const API_URL=process.env.REACT_APP_API_URL;

useEffect(()=>{

const token=localStorage.getItem("token");
if(!token){ setIsLoggedIn(false); return; }

const headers={Authorization:`Bearer ${token}`};

axios.get(`${API_URL}/api/airdata`,{headers})
.then(r=>setData(r.data))
.catch(()=>{
localStorage.removeItem("token");
setIsLoggedIn(false);
});

axios.get(`${API_URL}/api/user`,{headers})
.then(r=>setUser(r.data));

},[API_URL,setIsLoggedIn]);


// ===== STATISTICS =====

const avgAQI=data.length?
(data.reduce((s,i)=>s+i.aqi,0)/data.length).toFixed(1):0;

const maxPM=data.length?Math.max(...data.map(i=>i.pm25)):0;

const years=data.map(i=>new Date(i.date).getFullYear());
const aqi=data.map(i=>i.aqi);

// regression
function regression(y){
const n=y.length;
const x=[...Array(n).keys()];
const sx=x.reduce((a,b)=>a+b,0);
const sy=y.reduce((a,b)=>a+b,0);
const sxy=x.reduce((a,b,i)=>a+b*y[i],0);
const sx2=x.reduce((a,b)=>a+b*b,0);

const slope=(n*sxy-sx*sy)/(n*sx2-sx*sx);
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
tension:.4
},
{
label:"Forecast",
data:[...Array(aqi.length).fill(null),...forecast],
borderColor:"#ef4444",
borderDash:[6,6]
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

<h1>Air Quality Statistical Dashboard</h1>

{user &&
<div className="user">
<img src={user.profilePic}/>
<span>{user.name}</span>
<button onClick={logout}>Logout</button>
</div>
}

</header>

<div className="cards">

<Card title="Average AQI" value={avgAQI}/>
<Card title="Max PM2.5" value={maxPM}/>
<Card title="Trend slope" value={slope.toFixed(2)}/>
<Card title="Data points" value={data.length}/>

</div>

<div className="chartBox">
<h2>Time-Series Trend + Forecast</h2>
<Line data={trendChart}/>
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