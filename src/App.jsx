import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import * as API from "./api";

const C = {
  bg:"#07090F", surface:"#0B1019", card:"#0F1724", border:"#172031",
  accent:"#00D4A0", accentDim:"rgba(0,212,160,0.10)", accentGlow:"rgba(0,212,160,0.22)",
  blue:"#3D8EF5", blueDim:"rgba(61,142,245,0.10)",
  red:"#FF4560", redDim:"rgba(255,69,96,0.10)",
  yellow:"#FFBA2C", yellowDim:"rgba(255,186,44,0.10)",
  purple:"#9B7BFF", teal:"#22D3EE",
  text:"#E2EDF7", textDim:"#9AB5CC", textMuted:"#6B8CA8", wa:"#25D366",
  muted:"#6B8CA8", bg2:"#0B1019",
};
const F = "'IBM Plex Sans', system-ui, sans-serif";
const fmt = n => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.abs(n));
const daysTo = day => { const now=new Date(),t=new Date(now.getFullYear(),now.getMonth(),day); if(t<=now)t.setMonth(t.getMonth()+1); return Math.ceil((t-now)/86400000); };
const todayStr = () => new Date().toISOString().slice(0,10);

const PRIORITIES = ["Esencial","Importante","Flexible","Prescindible"];
const PM = {
  Esencial:     { color:"#FF4560", bg:"rgba(255,69,96,0.10)"   },
  Importante:   { color:"#FFBA2C", bg:"rgba(255,186,44,0.10)"  },
  Flexible:     { color:"#3D8EF5", bg:"rgba(61,142,245,0.10)"  },
  Prescindible: { color:"#7A9ABC", bg:"rgba(122,154,188,0.08)" },
};
// fixed-expense category → priority group
const FIXED_CAT_PRI = {
  "Vivienda":"Esencial", "Salud":"Esencial", "Servicios":"Esencial",
  "Transporte":"Esencial", "Seguros":"Esencial",
  "Inversión":"Importante", "Gimnasio":"Importante", "Celular":"Importante",
  "Telecom":"Importante", "Trabajo / Consulta":"Importante", "Educación":"Importante",
  "Entretenimiento":"Prescindible", "Suscripciones":"Prescindible",
  "Ropa":"Flexible", "Otros":"Flexible",
};
// benchmark as % of monthly income
const CAT_BM = {
  "Vivienda":        { pct:30, desc:"regla general ≤ 30%" },
  "Servicios":       { pct: 8, desc:"referencia ≤ 8%" },
  "Salud":           { pct: 7, desc:"mínimo recomendado ≥ 5%" },
  "Tecnología":      { pct: 5, desc:"sugerido ≤ 5%" },
  "Entretenimiento": { pct:10, desc:"flexible, ≤ 10%" },
};
const GROUP_BM = {
  "Esencial":     { pct:50, desc:"regla 50/30/20" },
  "Importante":   { pct:20, desc:"quiero-necesito" },
  "Flexible":     { pct:10, desc:"discrecional" },
  "Prescindible": { pct: 5, desc:"reducible primero" },
};

const BUDGET_CATS_DEFAULT = [
  { id:"vivienda",     icon:"🏠", name:"Vivienda",                        desc:"Renta, hipoteca, luz, agua, gas, internet básico",             defaultP:"Esencial"     },
  { id:"super",        icon:"🛒", name:"Alimentación — supermercado",     desc:"Despensa, frutas, básicos del hogar",                          defaultP:"Esencial"     },
  { id:"transp_b",     icon:"🚌", name:"Transporte básico",               desc:"Metro, camión, gasolina para ir al trabajo",                   defaultP:"Esencial"     },
  { id:"salud_m",      icon:"💊", name:"Salud — médico y farmacia",       desc:"Consultas, medicamentos, seguros de salud",                    defaultP:"Esencial"     },
  { id:"deuda",        icon:"💳", name:"Deuda comprometida (MSI)",        desc:"Pagos ya contraídos — no pagarlos tiene consecuencias",        defaultP:"Esencial"     },
  { id:"restaurantes", icon:"🥡", name:"Alimentación — restaurantes",     desc:"Comer fuera, Rappi, Uber Eats. Monto controlable",             defaultP:"Importante"   },
  { id:"gym",          icon:"🏋️", name:"Salud — gimnasio y bienestar",   desc:"Gym, psicólogo, vitaminas. Impacto real en productividad",     defaultP:"Importante"   },
  { id:"educacion",    icon:"📚", name:"Educación",                       desc:"Cursos, libros, certificaciones. Inversión en ingreso futuro", defaultP:"Importante"   },
  { id:"ahorro",       icon:"📈", name:"Ahorro e inversión",              desc:"Debería ser esencial — muchos lo tratan como opcional",        defaultP:"Importante"   },
  { id:"transp_d",     icon:"🚗", name:"Transporte discrecional",         desc:"Uber de conveniencia, estacionamientos, no laborales",         defaultP:"Flexible"     },
  { id:"ropa",         icon:"👕", name:"Ropa y cuidado personal",         desc:"Necesario en base; prescindible si excede el presupuesto",     defaultP:"Flexible"     },
  { id:"entret",       icon:"📺", name:"Entretenimiento y suscripciones", desc:"Netflix, Spotify, Disney+. El primero en recortar",            defaultP:"Prescindible" },
];
const GROUP_BUDGET_DEFAULTS = { Esencial:19177, Importante:5300, Flexible:1800, Prescindible:600 };
// ── Periodo helper ────────────────────────────────────────────────────────────
const MONTH_ABBR = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const periodoActual = () => { const d=new Date(); return `${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`; };

// ── API category (BBVA) ↔ dashboard category ─────────────────────────────────
const API_TO_DASH_CAT = {
  Restaurantes:            "Comida",
  "Super/Conveniencia":    "Supermercado",
  Viajes:                  "Compras",      // sin tab propio, va a Compras
  Salud:                   "Salud",
  Belleza:                 "Compras",
  "Ropa/Deportes":         "Compras",
  "Ropa/Moda":             "Compras",
  Compras:                 "Compras",
  "Compras online":        "Compras",
  Servicios:               "Otros",
  Transporte:              "Transporte",
  "Auto/Gasolina":         "Transporte",
  "Auto/Refacciones":      "Transporte",
  Entretenimiento:         "Suscripciones",
  "Entretenimiento/Viajes":"Compras",
  Telecom:                 "Suscripciones",
  Seguros:                 "Salud",
  Mascotas:                "Otros",
  "Hogar/Remodelacion":    "Otros",
  Tecnologia:              "Compras",
  "Deportes/Ocio":         "Suscripciones",
  Comisiones:              "Otros",
  Otro:                    "Otros",
};
const DASH_TO_API_CAT = {
  Comida:       "Restaurantes",
  Transporte:   "Transporte",
  Salud:        "Salud",
  Compras:      "Compras",
  Suscripciones:"Entretenimiento",
  Supermercado: "Super/Conveniencia",
  Ahorro:       "Otro",
  Ingreso:      "Otro",
  Otros:        "Otro",
};

// ── API data mappers ──────────────────────────────────────────────────────────
const mapApiTx = (t) => ({
  id: t.id,
  date: String(t.fecha_operacion ?? "").slice(0, 10),
  desc: t.descripcion ?? "",
  amt: -(Math.abs(Number(t.monto_mxn ?? 0))),
  cat: API_TO_DASH_CAT[t.categoria] ?? t.categoria ?? "Otros",
  icon: CAT_ICONS[API_TO_DASH_CAT[t.categoria]] ?? "💸",
  src: t.via ?? "manual",
  cardId: t.tarjeta_id ?? null,
});

const GRUPO_ICON = {
  "Inversión":"📈", "Gimnasio":"🏋️", "Trabajo / Consulta":"💻",
  "Celular":"📱", "Entretenimiento":"🎬", "Vivienda":"🏠",
  "Servicios":"💡", "Salud":"💊", "Transporte":"🚗", "Seguros":"🛡️",
};
const mapApiFijo = (f, i) => ({
  id: f.id ?? i + 1,
  name: f.detalle ?? f.nombre ?? f.descripcion ?? "Gasto fijo",
  amt: Number(f.monto ?? 0),
  cat: f.grupo ?? f.categoria ?? "Otros",
  icon: f.icono ?? GRUPO_ICON[f.grupo] ?? "💡",
  day: Number(f.dia_cobro ?? f.dia ?? 1),
});

const mapApiMsi = (m, i) => ({
  id: m.id ?? i + 1,
  name: String(m.descripcion ?? "").slice(0, 30),
  store: m.comercio ?? "—",
  total: Number(m.monto_total ?? 0),
  months: Number(m.total_pagos ?? 12),
  paid: Number((m.total_pagos ?? 12) - (m.pagos_restantes ?? 0)),
  start: String(m.fecha_inicio ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
  mo: Number(m.cuota_mensual ?? 0),
  cardId: m.tarjeta_id ?? null,
});

const CAT_GROUP = { Supermercado:"Esencial", Salud:"Esencial", Comida:"Importante", Ahorro:"Importante", Transporte:"Flexible", Compras:"Flexible", Otros:"Flexible", Suscripciones:"Prescindible", Ingreso:null };
const CAT_ICONS = { Comida:"🍽️", Transporte:"🚗", Salud:"💊", Compras:"🛍️", Suscripciones:"📱", Supermercado:"🛒", Ahorro:"📈", Ingreso:"💰", Otros:"💸" };
const TX_CATS = ["Comida","Transporte","Salud","Compras","Suscripciones","Supermercado","Ahorro","Ingreso","Otros"];
const FIXED_DEFAULT = [
  { id:1, name:"Departamento",   amt:8500, cat:"Vivienda",        icon:"🏠", day:1  },
  { id:2, name:"Netflix",        amt:219,  cat:"Entretenimiento", icon:"📺", day:15 },
  { id:3, name:"Spotify Family", amt:119,  cat:"Entretenimiento", icon:"🎵", day:15 },
  { id:4, name:"Smart Fit",      amt:499,  cat:"Salud",           icon:"🏋️", day:5  },
  { id:5, name:"Apple iCloud+",  amt:35,   cat:"Tecnología",      icon:"☁️", day:20 },
  { id:6, name:"TELMEX",         amt:599,  cat:"Servicios",       icon:"📞", day:10 },
  { id:7, name:"CFE Luz",        amt:380,  cat:"Servicios",       icon:"💡", day:8  },
  { id:8, name:"Amazon Prime",   amt:169,  cat:"Entretenimiento", icon:"📦", day:22 },
];
const MSI_DEFAULT = [];
const CARD_COLOR_PRESETS = [
  ["#002C7A","#0058C8"], // Azul
  ["#1A1A2E","#16213E"], // Negro
  ["#880000","#CC1E00"], // Rojo
  ["#003F6B","#006EA8"], // Índigo
  ["#1A4731","#276749"], // Verde
  ["#2D1B69","#5B2D8E"], // Morado
  ["#7B3F00","#C06000"], // Dorado
  ["#0D3B4E","#1A6A8A"], // Teal
];
const CARD_EMOJI_PRESETS = ["💳","🏦","💎","⭐","🌟","🔵","🔴","🟣","🟢","⚡","🌊","🔥","🏆","✨","🪙","💰"];
const mapApiCard = (c) => ({
  id: c.id, name: c.nombre, bank: c.banco,
  clr: [c.color_inicio||"#002C7A", c.color_fin||"#0058C8"],
  last4: c.last4, lim: Number(c.limite),
  used: Number(c.saldo_usado||0),
  cut: Number(c.dia_corte), pay: Number(c.dia_pago),
  icon: c.icono||"💳",
});
let _txId = 200;
const PREV_SAVINGS_DEFAULT = 16500;
const INIT_TX = [];
const EXP_CATS   = ["Supermercado","Salud","Transporte","Compras","Comida","Suscripciones"];
const EXP_COLORS = { Comida:"#FF4560", Transporte:"#3D8EF5", Salud:"#00D4A0", Compras:"#9B7BFF", Suscripciones:"#FFBA2C", Supermercado:"#22D3EE" };
const EXPENSE_TREND_RAW = [
  { m:"Ene", Comida:3200, Transporte:1800, Salud:500,  Compras:2100, Suscripciones:338, Supermercado:1800 },
  { m:"Feb", Comida:3800, Transporte:2100, Salud:800,  Compras:3200, Suscripciones:338, Supermercado:2100 },
  { m:"Mar", Comida:3100, Transporte:1900, Salud:600,  Compras:1800, Suscripciones:338, Supermercado:2200 },
  { m:"Abr", Comida:4200, Transporte:2300, Salud:700,  Compras:3500, Suscripciones:338, Supermercado:2800 },
  { m:"May", Comida:3240, Transporte:784,  Salud:839,  Compras:1890, Suscripciones:338, Supermercado:1240 },
];
const EXPENSE_TREND = EXPENSE_TREND_RAW.map(r=>({...r,total:EXP_CATS.reduce((s,c)=>s+(r[c]||0),0)}));
const BUDGET_VS_REAL = [
  { cat:"Comida",     bud:4000, real:3240 },
  { cat:"Transporte", bud:2000, real:1890 },
  { cat:"Entret.",    bud:1500, real:1820 },
  { cat:"Salud",      bud:1000, real:840  },
  { cat:"Compras",    bud:3000, real:4100 },
];

const computeAlerts = (txs, fixedItems, INCOME, msiPlans) => {
  const totalFixed=fixedItems.reduce((s,f)=>s+f.amt,0), totalMSI=msiPlans.reduce((s,p)=>s+p.mo,0);
  const committed=totalFixed+totalMSI, committedR=committed/INCOME;
  const disposable=Math.max(0,INCOME-committed);
  const varSpent=txs.filter(t=>t.amt<0&&t.cat!=="Ahorro").reduce((s,t)=>s+Math.abs(t.amt),0);
  const varR=disposable>0?varSpent/disposable:0;
  const savings=txs.filter(t=>t.cat==="Ahorro").reduce((s,t)=>s+Math.abs(t.amt),0);
  const savR=savings/INCOME;
  return [
    committedR>0.65 && { type:"danger", msg:`Fijos+MSI = ${Math.round(committedR*100)}% del ingreso`, detail:`${fmt(committed)} comprometidos de ${fmt(INCOME)}. Superar 65% deja poco margen.` },
    committedR>0.50&&committedR<=0.65 && { type:"warn", msg:`Fijos+MSI = ${Math.round(committedR*100)}% del ingreso`, detail:`${fmt(committed)} comprometidos. Zona de precaución 50–65%.` },
    varR>0.85&&disposable>0 && { type:"danger", msg:`Gasto variable: ${Math.round(varR*100)}% del disponible`, detail:`Gastados ${fmt(varSpent)} de ${fmt(disposable)} disponibles.` },
    varR>0.65&&varR<=0.85&&disposable>0 && { type:"warn", msg:`Gasto variable: ${Math.round(varR*100)}% del disponible`, detail:`Gastados ${fmt(varSpent)} de ${fmt(disposable)}.` },
    savR<0.05 && { type:"warn", msg:`Ahorro del mes: ${Math.round(savR*100)}% del ingreso`, detail:`Solo ${fmt(savings)} destinados a ahorro este mes.` },
  ].filter(Boolean);
};

// ── PRIMITIVES ────────────────────────────────────────────────────────────────
const ProgressBar = ({ value, max, color=C.accent, h=6 }) => {
  const pct=Math.min((value/max)*100,100), col=pct>85?C.red:pct>65?C.yellow:color;
  return <div style={{ background:C.border, borderRadius:99, height:h, overflow:"hidden" }}><div style={{ width:`${pct}%`, height:"100%", background:col, borderRadius:99, transition:"width 0.7s cubic-bezier(0.34,1.56,0.64,1)", boxShadow:`0 0 8px ${col}50` }}/></div>;
};
// Bar with a benchmark marker line
const BenchmarkBar = ({ value, benchmark, color=C.accent, h=5 }) => {
  const scale = Math.max(value, benchmark) * 1.4 || 1;
  const fillPct = Math.min(value/scale*100, 100);
  const markPct = Math.min(benchmark/scale*100, 100);
  const col = value > benchmark*1.2 ? C.red : value > benchmark ? C.yellow : color;
  return (
    <div style={{ position:"relative", height:h+8 }}>
      <div style={{ position:"absolute", top:4, left:0, right:0, height:h, background:C.border, borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${fillPct}%`, height:"100%", background:col, borderRadius:99, boxShadow:`0 0 4px ${col}60` }}/>
      </div>
      <div style={{ position:"absolute", top:1, left:`${markPct}%`, width:2, height:h+6, background:C.yellow+"CC", borderRadius:1, transform:"translateX(-1px)", zIndex:2 }}/>
    </div>
  );
};
// Score factor row: thin bar + pts contribution
const ScoreFactorRow = ({ label, detail, pts, maxPts }) => {
  const col = pts>=maxPts?C.accent:pts>=maxPts*0.6?C.yellow:C.red;
  const delta = pts - maxPts;
  return (
    <div style={{ marginBottom:11 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
        <div style={{ minWidth:0, flex:1 }}>
          <span style={{ color:C.text, fontSize:12, fontFamily:F, fontWeight:500 }}>{label}</span>
          <span style={{ color:C.textMuted, fontSize:11, fontFamily:F }}> · {detail}</span>
        </div>
        <span style={{ color:col, fontSize:12, fontFamily:F, fontWeight:700, flexShrink:0, marginLeft:10 }}>
          {delta===0?`+${maxPts}`:delta} pts
        </span>
      </div>
      <div style={{ height:3, background:C.border, borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${(pts/maxPts)*100}%`, height:"100%", background:col, borderRadius:99 }}/>
      </div>
    </div>
  );
};
const Chip = ({ children, color=C.accent, bg=C.accentDim }) => (
  <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:600, color, background:bg, fontFamily:F }}>{children}</span>
);
const SCard = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 24px", cursor:onClick?"pointer":"default", ...style }}>{children}</div>
);
const Label = ({ children }) => (
  <div style={{ color:C.textMuted, fontSize:11, fontFamily:F, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 }}>{children}</div>
);
const ScoreGauge = ({ score, w=140, h=105 }) => {
  const r=58,cx=78,cy=78,s0=-220,s1=40,toRad=d=>(d*Math.PI)/180;
  const arc=(a1,a2)=>{const x1=cx+r*Math.cos(toRad(a1)),y1=cy+r*Math.sin(toRad(a1)),x2=cx+r*Math.cos(toRad(a2)),y2=cy+r*Math.sin(toRad(a2));return`M ${x1} ${y1} A ${r} ${r} 0 ${a2-a1>180?1:0} 1 ${x2} ${y2}`;};
  const vd=s0+(score/100)*(s1-s0), col=score>=70?C.accent:score>=40?C.yellow:C.red;
  return <svg viewBox="0 0 156 116" style={{ width:w, height:h }}>
    <path d={arc(s0,s1)} fill="none" stroke={C.border} strokeWidth={9} strokeLinecap="round"/>
    <path d={arc(s0,vd)} fill="none" stroke={col} strokeWidth={9} strokeLinecap="round"/>
    <text x={cx} y={cy+4}  textAnchor="middle" fill={col}      fontSize={30} fontWeight={700} fontFamily={F}>{score}</text>
    <text x={cx} y={cy+22} textAnchor="middle" fill={C.textDim} fontSize={11} fontFamily={F}>{score>=80?"Excelente":score>=60?"Bueno":score>=40?"Regular":"Crítico"}</text>
  </svg>;
};
const BudgetTip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  const entry=BUDGET_VS_REAL.find(e=>e.cat===label);
  return <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", fontFamily:F }}>
    <div style={{ color:C.textMuted, fontSize:12, marginBottom:6 }}>{label}</div>
    {payload.map(p=>{ const isReal=p.dataKey==="real", col=isReal?(entry&&p.value>entry.bud?C.red:C.accent):C.blue; return <div key={p.name} style={{ color:col, fontSize:13, fontWeight:600, marginBottom:2 }}>{p.name}: {fmt(p.value)}</div>; })}
  </div>;
};
const ExpTrendTip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  const row=EXPENSE_TREND_RAW.find(r=>r.m===label);
  const total=row?EXP_CATS.reduce((s,c)=>s+(row[c]||0),0):0;
  return <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", fontFamily:F }}>
    <div style={{ color:C.textMuted, fontSize:12, marginBottom:8 }}>{label}</div>
    <div style={{ color:C.blue, fontSize:13, fontWeight:700, marginBottom:10 }}>Total: {fmt(total)}</div>
    {row&&EXP_CATS.map(cat=>row[cat]?<div key={cat} style={{ display:"flex", justifyContent:"space-between", gap:20, marginBottom:4 }}>
      <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:6, height:6, borderRadius:"50%", background:EXP_COLORS[cat] }}/><span style={{ color:C.textDim, fontSize:11 }}>{cat}</span></div>
      <span style={{ color:EXP_COLORS[cat], fontSize:11, fontWeight:600 }}>{fmt(row[cat])}</span>
    </div>:null)}
  </div>;
};
const PieDistrib = ({ data, size=180 }) => {
  const sorted=[...data].filter(d=>d.value>0).sort((a,b)=>b.value-a.value);
  const total=sorted.reduce((s,d)=>s+d.value,0);
  if (!total) return null;
  return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:32 }}>
      <PieChart width={size} height={size} style={{ flexShrink:0 }}>
        <Pie data={sorted} dataKey="value" cx="50%" cy="50%" innerRadius={size*0.27} outerRadius={size*0.44} paddingAngle={2}>
          {sorted.map((e,i)=><Cell key={i} fill={e.color}/>)}
        </Pie>
        <Tooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, fontFamily:F, fontSize:12 }} cursor={false}/>
      </PieChart>
      <div style={{ display:"flex", flexDirection:"column", gap:8, width:220, flexShrink:0 }}>
        {sorted.map(item=>(
          <div key={item.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:item.color }}/>
              <span style={{ color:C.textDim, fontSize:12, fontFamily:F }}>{item.name}</span>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <span style={{ color:item.color, fontSize:12, fontWeight:600, fontFamily:F }}>{fmt(item.value)}</span>
              <span style={{ color:C.textMuted, fontSize:11, fontFamily:F, minWidth:28, textAlign:"right" }}>{((item.value/total)*100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── NOTIFICATION BELL ─────────────────────────────────────────────────────────
function NotificationBell({ alerts }) {
  const [open,setOpen]=useState(false); const ref=useRef(null);
  useEffect(()=>{ const h=e=>{ if(ref.current&&!ref.current.contains(e.target))setOpen(false); }; if(open)document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h); },[open]);
  const dotCol=alerts.some(a=>a.type==="danger")?C.red:alerts.some(a=>a.type==="warn")?C.yellow:C.accent;
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ width:36, height:36, borderRadius:10, background:"transparent", border:`1px solid ${C.border}`, cursor:"pointer", color:C.textDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, position:"relative" }}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=dotCol;e.currentTarget.style.color=dotCol;}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textDim;}}>
        🔔{alerts.length>0&&<div style={{ position:"absolute", top:7, right:7, width:7, height:7, borderRadius:"50%", background:dotCol, boxShadow:`0 0 5px ${dotCol}` }}/>}
      </button>
      {open&&<div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, width:340, background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 20px", zIndex:400, boxShadow:"0 16px 48px rgba(0,0,0,0.5)", animation:"slideUp .2s ease" }}>
        <div style={{ color:C.textMuted, fontSize:11, fontFamily:F, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:12 }}>Alertas financieras</div>
        {alerts.length===0
          ? <div style={{ color:C.textMuted, fontSize:13, fontFamily:F }}>Sin alertas activas</div>
          : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {alerts.map((a,i)=>(
                <div key={i} style={{ padding:"10px 14px", borderRadius:10, borderLeft:`3px solid ${a.type==="danger"?C.red:a.type==="warn"?C.yellow:C.blue}`, background:a.type==="danger"?C.redDim:a.type==="warn"?C.yellowDim:C.blueDim }}>
                  <div style={{ color:C.text, fontSize:13, fontFamily:F, fontWeight:500, marginBottom:3 }}>{a.msg}</div>
                  <div style={{ color:C.textDim, fontSize:11, fontFamily:F, lineHeight:1.45 }}>{a.detail}</div>
                </div>
              ))}
            </div>}
      </div>}
    </div>
  );
}

// ── MODALS ────────────────────────────────────────────────────────────────────
const IS = { background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.text, fontFamily:F, fontSize:13, outline:"none", width:"100%" };
const BtnP = { background:C.accent, border:"none", borderRadius:8, color:C.bg, padding:"8px 18px", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:F };
const BtnS = { background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, color:C.textDim, padding:"8px 18px", cursor:"pointer", fontSize:13, fontFamily:F };

function TxModal({ tx, cards, onSave, onClose }) {
  const [d,setD]=useState({...tx});
  const isNew=!tx.id;
  const save=()=>{ if(!d.desc||!d.amt)return; onSave({...d,id:d.id||++_txId,amt:parseFloat(d.amt)||0,icon:CAT_ICONS[d.cat]||"💸"}); onClose(); };
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:480, background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:"24px 28px", animation:"slideUp .25s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ color:C.text, fontSize:16, fontWeight:600, fontFamily:F }}>{isNew?"Nueva transacción":"Editar transacción"}</div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.textDim, fontSize:18 }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          {[["desc","Descripción",{ placeholder:"ej: Rappi – Sushi" }],["date","Fecha",{ type:"date" }]].map(([k,l,ex])=>(
            <div key={k}><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>{l}</div><input {...ex} value={d[k]||""} onChange={e=>setD(p=>({...p,[k]:e.target.value}))} style={IS}/></div>
          ))}
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Monto (negativo = gasto)</div><input type="number" value={d.amt||""} onChange={e=>setD(p=>({...p,amt:e.target.value}))} placeholder="-350" style={IS}/></div>
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Categoría</div><select value={d.cat||"Comida"} onChange={e=>setD(p=>({...p,cat:e.target.value}))} style={IS}>{TX_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Tarjeta</div><select value={d.cardId||""} onChange={e=>setD(p=>({...p,cardId:e.target.value?parseInt(e.target.value):null}))} style={IS}><option value="">Sin tarjeta</option>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Origen</div><select value={d.src||"manual"} onChange={e=>setD(p=>({...p,src:e.target.value}))} style={IS}><option value="manual">Manual</option><option value="whatsapp">WhatsApp</option></select></div>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={BtnS}>Cancelar</button>
          <button onClick={save} style={BtnP}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
function FixedModal({ item, onSave, onClose }) {
  const [d,setD]=useState({...item});
  const save=()=>{ if(!d.name||!d.amt)return; onSave({...d,id:d.id||Date.now(),amt:parseFloat(d.amt)||0}); onClose(); };
  const FIXED_CATS=[
    // Esencial
    "Vivienda","Salud","Servicios","Transporte","Seguros",
    // Importante
    "Inversión","Gimnasio","Celular","Telecom","Trabajo / Consulta","Educación",
    // Prescindible
    "Entretenimiento","Suscripciones",
    // Flexible
    "Ropa","Otros",
  ];
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:440, background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:"24px 28px", animation:"slideUp .25s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ color:C.text, fontSize:16, fontWeight:600, fontFamily:F }}>{d.id?"Editar gasto fijo":"Nuevo gasto fijo"}</div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.textDim, fontSize:18 }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          {[["name","Concepto",{ placeholder:"ej: Netflix" }],["icon","Emoji",{ placeholder:"📺", maxLength:2 }]].map(([k,l,ex])=>(
            <div key={k}><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>{l}</div><input {...ex} value={d[k]||""} onChange={e=>setD(p=>({...p,[k]:e.target.value}))} style={IS}/></div>
          ))}
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Monto mensual</div><input type="number" value={d.amt||""} onChange={e=>setD(p=>({...p,amt:e.target.value}))} style={IS}/></div>
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Día de cobro</div><input type="number" min="1" max="31" value={d.day||1} onChange={e=>setD(p=>({...p,day:parseInt(e.target.value)||1}))} style={IS}/></div>
          <div style={{ gridColumn:"1/-1" }}><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Categoría</div><select value={d.cat||"Servicios"} onChange={e=>setD(p=>({...p,cat:e.target.value}))} style={IS}>{FIXED_CATS.map(c=><option key={c} value={c}>{c} — {FIXED_CAT_PRI[c]||"Flexible"}</option>)}</select></div>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={BtnS}>Cancelar</button>
          <button onClick={save} style={BtnP}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── CARD DETAIL MODAL ─────────────────────────────────────────────────────────
function CardDetailModal({ card, txs, msiPlans, onClose }) {
  const cardTxs=txs.filter(t=>t.cardId===card.id&&t.amt<0);
  const cardMsi=msiPlans.filter(m=>m.cardId===card.id);
  const totalSpent=cardTxs.reduce((s,t)=>s+Math.abs(t.amt),0);
  const byCat=cardTxs.reduce((acc,t)=>{ acc[t.cat]=(acc[t.cat]||0)+Math.abs(t.amt); return acc; },{});
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:520, maxHeight:"82vh", background:C.surface, border:`1px solid ${C.border}`, borderRadius:24, overflow:"hidden", display:"flex", flexDirection:"column", animation:"slideUp .25s ease" }}>
        <div style={{ background:`linear-gradient(135deg,${card.clr[0]},${card.clr[1]})`, padding:"24px 28px", position:"relative", overflow:"hidden", flexShrink:0 }}>
          <button onClick={onClose} style={{ position:"absolute", top:14, right:14, width:28, height:28, borderRadius:"50%", background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          <div style={{ color:"rgba(255,255,255,0.55)", fontSize:10, fontFamily:F, textTransform:"uppercase" }}>{card.bank}</div>
          <div style={{ color:"#fff", fontSize:20, fontWeight:700, fontFamily:F, marginTop:4 }}>{card.name}</div>
          <div style={{ color:"rgba(255,255,255,0.45)", fontSize:13, fontFamily:F, marginTop:10, letterSpacing:"0.18em" }}>•••• •••• •••• {card.last4}</div>
          <div style={{ display:"flex", gap:32, marginTop:16 }}>
            {[["Usado",fmt(card.used)],["Límite",fmt(card.lim)],["Disponible",fmt(card.lim-card.used)]].map(([l,v])=>(
              <div key={l}><div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, fontFamily:F, textTransform:"uppercase" }}>{l}</div><div style={{ color:"#fff", fontSize:16, fontWeight:700, fontFamily:F }}>{v}</div></div>
            ))}
          </div>
        </div>
        <div style={{ overflowY:"auto", padding:"20px 24px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
            {[{lbl:"Gastado",val:fmt(totalSpent),col:C.red},{lbl:"Transacciones",val:cardTxs.length,col:C.blue},{lbl:"Utilización",val:`${((card.used/card.lim)*100).toFixed(0)}%`,col:C.yellow}].map(s=>(
              <div key={s.lbl} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px" }}>
                <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase", marginBottom:6 }}>{s.lbl}</div>
                <div style={{ color:s.col, fontSize:20, fontWeight:700, fontFamily:F }}>{s.val}</div>
              </div>
            ))}
          </div>
          {Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
            <div key={cat} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}><span style={{ color:C.textDim, fontSize:12, fontFamily:F }}>{cat}</span><span style={{ color:C.text, fontSize:12, fontFamily:F, fontWeight:600 }}>{fmt(amt)}</span></div>
              <ProgressBar value={amt} max={totalSpent} h={4}/>
            </div>
          ))}
          {cardMsi.length>0&&<div style={{ margin:"16px 0" }}>
            <Label>Planes MSI</Label>
            {cardMsi.map(p=>(
              <div key={p.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div><div style={{ color:C.text, fontSize:13, fontFamily:F, fontWeight:500 }}>{p.name}</div><div style={{ color:C.textMuted, fontSize:11 }}>{p.paid}/{p.months} cuotas</div></div>
                <div style={{ color:C.yellow, fontSize:14, fontWeight:700, fontFamily:F }}>{fmt(p.mo)}/mes</div>
              </div>
            ))}
          </div>}
          <Label>Últimas transacciones</Label>
          {cardTxs.slice(0,6).map(tx=>(
            <div key={tx.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.card, border:`1px solid ${C.border}`, borderRadius:10, marginBottom:6 }}>
              <span style={{ fontSize:16 }}>{tx.icon}</span>
              <div style={{ flex:1 }}><div style={{ color:C.text, fontSize:13, fontFamily:F }}>{tx.desc}</div><div style={{ color:C.textMuted, fontSize:11 }}>{tx.date} · {tx.cat}</div></div>
              <div style={{ color:C.red, fontWeight:700, fontSize:13, fontFamily:F }}>{fmt(tx.amt)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── IMPORT MODAL ──────────────────────────────────────────────────────────────
function ImportModal({ card, onDone, onClose }) {
  const [archivo, setArchivo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const importar = async () => {
    if (!archivo) return;
    setBusy(true); setErr("");
    try {
      const csv = await archivo.text();
      const r = await API.importCSV(csv, card.id);
      setResult(r);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:460, background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:"24px 28px", animation:"slideUp .25s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ color:C.text, fontSize:16, fontWeight:600, fontFamily:F }}>Importar estado de cuenta</div>
            <div style={{ color:C.textMuted, fontSize:12, fontFamily:F, marginTop:3 }}>💳 {card.name} · {card.bank}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.textDim, fontSize:18 }}>✕</button>
        </div>

        {!result ? <>
          <div style={{ background:C.card, border:`2px dashed ${C.border}`, borderRadius:12, padding:"28px 20px", textAlign:"center", marginBottom:16 }}>
            <div style={{ color:C.textMuted, fontSize:13, fontFamily:F, marginBottom:12 }}>Selecciona el CSV exportado desde BBVA</div>
            <input type="file" accept=".csv" onChange={e=>setArchivo(e.target.files[0])} style={{ color:C.text, fontFamily:F, fontSize:13 }}/>
            {archivo&&<div style={{ color:C.accent, fontSize:12, fontFamily:F, marginTop:10 }}>✓ {archivo.name}</div>}
          </div>
          <div style={{ color:C.textMuted, fontSize:11, fontFamily:F, lineHeight:1.6, marginBottom:16 }}>
            En BBVA: <strong style={{ color:C.textDim }}>Estados de cuenta → Descargar CSV</strong>. Las transacciones ya importadas se ignoran automáticamente.
          </div>
          {err&&<div style={{ color:C.red, fontSize:12, fontFamily:F, marginBottom:12 }}>{err}</div>}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={BtnS}>Cancelar</button>
            <button onClick={importar} disabled={busy||!archivo} style={{ ...BtnP, opacity:(!archivo||busy)?0.5:1 }}>{busy?"Importando…":"Importar"}</button>
          </div>
        </> : <>
          <div style={{ background:C.accentDim, border:`1px solid ${C.accentGlow}`, borderRadius:12, padding:"20px 24px", marginBottom:20, textAlign:"center" }}>
            <div style={{ color:C.accent, fontSize:32, marginBottom:8 }}>✓</div>
            <div style={{ color:C.text, fontSize:15, fontWeight:600, fontFamily:F }}>Importación completada</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:14 }}>
              {[{lbl:"Transacciones",val:result.transacciones},{lbl:"Planes MSI",val:result.msi}].map(m=>(
                <div key={m.lbl} style={{ background:C.card, borderRadius:10, padding:"10px 14px" }}>
                  <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase" }}>{m.lbl}</div>
                  <div style={{ color:C.accent, fontSize:20, fontWeight:700, fontFamily:F }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button onClick={onDone} style={BtnP}>Listo</button>
          </div>
        </>}
      </div>
    </div>
  );
}

// ── CARD MODAL ────────────────────────────────────────────────────────────────
function CardModal({ card, onSave, onClose }) {
  const isNew=!card.id;
  const [d,setD]=useState({
    nombre: card.nombre||"", banco: card.banco||"", last4: card.last4||"",
    limite: card.limite!=null?String(card.limite):"", saldo_usado: card.saldo_usado!=null?String(card.saldo_usado):"0",
    dia_corte: card.dia_corte||15, dia_pago: card.dia_pago||10,
    color_inicio: card.color_inicio||"#002C7A", color_fin: card.color_fin||"#0058C8",
    icono: card.icono||"💳",
  });
  const [busy,setBusy]=useState(false);
  const [analizando,setAnalizando]=useState(false);
  const [parseErr,setParseErr]=useState("");
  const [analizado,setAnalizado]=useState(false);
  const fileRef=useRef(null);

  const analizarPDF=async(e)=>{
    const file=e.target.files?.[0]; if(!file)return;
    setAnalizando(true); setParseErr("");
    try{
      const buffer=await file.arrayBuffer();
      const bytes=new Uint8Array(buffer);
      let bin=""; for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]);
      const b64=btoa(bin);
      const info=await API.parseEstadoCuenta(b64);
      setD(p=>({
        ...p,
        nombre:    info.nombre_tarjeta || p.nombre,
        banco:     info.banco          || p.banco,
        last4:     info.last4          || p.last4,
        limite:    info.limite!=null   ? String(info.limite)       : p.limite,
        saldo_usado: info.saldo_usado!=null ? String(info.saldo_usado) : p.saldo_usado,
        dia_corte: info.dia_corte      || p.dia_corte,
        dia_pago:  info.dia_pago       || p.dia_pago,
      }));
      setAnalizado(true);
    } catch(e){ setParseErr("No se pudo leer el PDF. Verifica que sea un estado de cuenta BBVA."); }
    finally{ setAnalizando(false); e.target.value=""; }
  };

  const save=async()=>{
    if(!d.nombre||!d.last4)return;
    setBusy(true);
    try{ await onSave({...d, limite:parseFloat(d.limite)||0, saldo_usado:parseFloat(d.saldo_usado)||0, dia_corte:parseInt(d.dia_corte)||15, dia_pago:parseInt(d.dia_pago)||10}); onClose(); }
    finally{ setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:500, background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:"24px 28px", animation:"slideUp .25s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ color:C.text, fontSize:16, fontWeight:600, fontFamily:F }}>{isNew?"Nueva tarjeta":"Editar tarjeta"}</div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.textDim, fontSize:18 }}>✕</button>
        </div>

        {/* PDF analyzer */}
        <input ref={fileRef} type="file" accept=".pdf" onChange={analizarPDF} style={{ display:"none" }}/>
        <div style={{ background:analizado?C.accentDim:C.card, border:`1px solid ${analizado?C.accentGlow:C.border}`, borderRadius:12, padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ flex:1 }}>
            <div style={{ color:analizado?C.accent:C.text, fontSize:13, fontWeight:600, fontFamily:F }}>
              {analizado?"✓ Estado de cuenta analizado":"📄 Analizar estado de cuenta BBVA"}
            </div>
            <div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginTop:3, lineHeight:1.5 }}>
              {analizado
                ? "Los campos se llenaron automáticamente. Revisa y ajusta si es necesario."
                : "Sube el PDF para extraer automáticamente límite, saldo, días de corte y pago."}
            </div>
            {parseErr&&<div style={{ color:C.red, fontSize:11, fontFamily:F, marginTop:4 }}>{parseErr}</div>}
          </div>
          <button onClick={()=>fileRef.current?.click()} disabled={analizando}
            style={{ ...BtnP, padding:"8px 16px", fontSize:12, background:analizado?C.accent:C.blue, flexShrink:0, opacity:analizando?0.6:1 }}>
            {analizando?"Analizando…":analizado?"Volver a analizar":"Subir PDF"}
          </button>
        </div>

        {/* Campos (revisión / entrada manual) */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          <div style={{ gridColumn:"1/-1" }}><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Nombre de la tarjeta</div><input value={d.nombre} onChange={e=>setD(p=>({...p,nombre:e.target.value}))} placeholder="ej: BBVA Dorada" style={IS}/></div>
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Banco</div><input value={d.banco} onChange={e=>setD(p=>({...p,banco:e.target.value}))} placeholder="BBVA" style={IS}/></div>
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Últimos 4 dígitos</div><input value={d.last4} onChange={e=>setD(p=>({...p,last4:e.target.value}))} placeholder="9607" maxLength={4} style={IS}/></div>
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Límite de crédito</div><input type="number" value={d.limite} onChange={e=>setD(p=>({...p,limite:e.target.value}))} placeholder="200000" style={IS}/></div>
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Saldo al corte</div><input type="number" value={d.saldo_usado} onChange={e=>setD(p=>({...p,saldo_usado:e.target.value}))} placeholder="0" style={IS}/></div>
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Día de corte</div><input type="number" min="1" max="31" value={d.dia_corte} onChange={e=>setD(p=>({...p,dia_corte:parseInt(e.target.value)||15}))} style={IS}/></div>
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Día límite de pago</div><input type="number" min="1" max="31" value={d.dia_pago} onChange={e=>setD(p=>({...p,dia_pago:parseInt(e.target.value)||10}))} style={IS}/></div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:8 }}>Ícono de la tarjeta</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {CARD_EMOJI_PRESETS.map(e=>(
              <div key={e} onClick={()=>setD(p=>({...p,icono:e}))}
                style={{ width:36, height:36, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, cursor:"pointer", background:d.icono===e?C.accentDim:C.card, border:d.icono===e?`2px solid ${C.accent}`:`1px solid ${C.border}`, transition:"border 0.15s" }}>
                {e}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:18 }}>
          <div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:8 }}>Color de la tarjeta</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {CARD_COLOR_PRESETS.map(([c1,c2])=>(
              <div key={c1} onClick={()=>setD(p=>({...p,color_inicio:c1,color_fin:c2}))}
                style={{ width:36, height:22, borderRadius:7, background:`linear-gradient(135deg,${c1},${c2})`, cursor:"pointer", border:d.color_inicio===c1?`2px solid ${C.accent}`:`2px solid transparent`, transition:"border 0.15s" }}/>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={BtnS}>Cancelar</button>
          <button onClick={save} disabled={busy||!d.nombre||!d.last4} style={{ ...BtnP, opacity:(!d.nombre||!d.last4)?0.5:1 }}>
            {busy?"Guardando…":"Guardar tarjeta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────
const TIPOS_EXCLUIR = ["pago","msi_cuota","abono_puntos","abono"];

function Transactions({ txs, setTxs, onAdd, cards }) {
  const [type,setType]=useState("all"); const [catF,setCatF]=useState("all");
  const [cardF,setCardF]=useState("all"); const [from,setFrom]=useState(""); const [to,setTo]=useState("");
  const [editTx,setEditTx]=useState(null); const [addingTx,setAddingTx]=useState(false);
  const [localTxs,setLocalTxs]=useState([]);
  const [cargando,setCargando]=useState(true);
  const [editMode,setEditMode]=useState(false);

  useEffect(()=>{
    setCargando(true);
    API.getGastos({ limit:500 })
      .then(rows=>{
        const mapped=rows
          .filter(t=>!TIPOS_EXCLUIR.includes(t.tipo))
          .map(mapApiTx);
        setLocalTxs(mapped.length ? mapped : txs);
      })
      .catch(err=>{ console.error("Error cargando transacciones:",err); setLocalTxs(txs); })
      .finally(()=>setCargando(false));
  },[]);

  const cats=["all",...new Set(localTxs.map(t=>t.cat))];
  const list=localTxs.filter(t=>{
    if(type==="gastos"&&t.amt>=0)return false; if(type==="abonos"&&t.amt<0)return false;
    if(catF!=="all"&&t.cat!==catF)return false;
    if(cardF==="sin"&&t.cardId!==null)return false;
    if(cardF!=="all"&&cardF!=="sin"&&t.cardId!==parseInt(cardF))return false;
    if(from&&t.date<from)return false; if(to&&t.date>to)return false;
    return true;
  });
  const saveTx=tx=>{
    if(tx.id&&localTxs.find(t=>t.id===tx.id)){
      setLocalTxs(p=>p.map(t=>t.id===tx.id?tx:t));
      setTxs(p=>p.map(t=>t.id===tx.id?tx:t));
    } else { onAdd(tx); setLocalTxs(p=>[tx,...p]); }
  };
  const delTx=id=>{
    if(confirm("¿Eliminar esta transacción?")){
      setLocalTxs(p=>p.filter(t=>t.id!==id));
      setTxs(p=>p.filter(t=>t.id!==id));
      API.deleteGasto(id).catch(console.error);
    }
  };
  const Fb=({val,cur,label,onClick})=><button onClick={onClick} style={{ padding:"5px 14px", borderRadius:99, fontSize:12, fontWeight:500, fontFamily:F, border:val===cur?"none":`1px solid ${C.border}`, background:val===cur?C.accent:"transparent", color:val===cur?C.bg:C.textDim, cursor:"pointer" }}>{label}</button>;
  const sel={ background:C.card, border:`1px solid ${C.border}`, color:C.text, borderRadius:8, padding:"5px 10px", fontSize:12, fontFamily:F, cursor:"pointer", outline:"none" };
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ color:C.textMuted, fontSize:11, fontFamily:F }}>TIPO</span>
        {[["all","Todos"],["gastos","Gastos"],["abonos","Abonos"]].map(([v,l])=><Fb key={v} val={v} cur={type} label={l} onClick={()=>setType(v)}/>)}
        <div style={{ width:1, height:18, background:C.border, margin:"0 4px" }}/>
        <select value={catF} onChange={e=>setCatF(e.target.value)} style={sel}>{cats.map(c=><option key={c} value={c}>{c==="all"?"Todas":c}</option>)}</select>
        <div style={{ width:1, height:18, background:C.border, margin:"0 4px" }}/>
        <select value={cardF} onChange={e=>setCardF(e.target.value)} style={sel}>
          <option value="all">Todas las tarjetas</option><option value="sin">Sin tarjeta</option>
          {cards.map(c=><option key={c.id} value={c.id.toString()}>{c.name}</option>)}
        </select>
        <div style={{ width:1, height:18, background:C.border, margin:"0 4px" }}/>
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={sel}/>
        <span style={{ color:C.textMuted, fontSize:11, fontFamily:F }}>—</span>
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={sel}/>
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          {editMode&&<button onClick={()=>{ if(confirm(`¿Eliminar las ${list.length} transacciones visibles?`)){list.forEach(t=>{setLocalTxs(p=>p.filter(x=>x.id!==t.id));setTxs(p=>p.filter(x=>x.id!==t.id));API.deleteGasto(t.id).catch(console.error);});} }} style={{ ...BtnP, background:C.red, padding:"6px 14px", fontSize:12 }}>Eliminar todas</button>}
          <button onClick={()=>setEditMode(m=>!m)} style={{ padding:"6px 14px", borderRadius:8, fontSize:12, fontFamily:F, border:`1px solid ${editMode?C.accent:C.border}`, background:editMode?C.accentDim:"transparent", color:editMode?C.accent:C.textDim, cursor:"pointer" }}>{editMode?"Listo":"Gestionar"}</button>
          <button onClick={()=>setAddingTx(true)} style={{ ...BtnP, padding:"6px 16px", fontSize:12 }}>+ Añadir</button>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"44px 34px 1fr 78px 110px 96px 140px 72px 76px", padding:"5px 14px", marginBottom:5, fontFamily:F, fontSize:10, color:C.textMuted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em" }}>
        <div>#ID</div><div/><div>Descripción</div><div>Fecha</div><div>Categoría</div><div style={{ textAlign:"right" }}>Monto</div><div style={{ textAlign:"center" }}>Tarjeta</div><div style={{ textAlign:"center" }}>Origen</div><div/>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {cargando
          ? <div style={{ color:C.textMuted, fontSize:14, fontFamily:F, textAlign:"center", padding:"60px 0" }}>Cargando transacciones…</div>
          : list.length===0
            ? <div style={{ color:C.textMuted, fontSize:14, fontFamily:F, textAlign:"center", padding:"40px 0" }}>Sin transacciones con esos filtros</div>
            : list.map((tx,i)=>{
                const card=cards.find(c=>c.id===tx.cardId);
                return (
                  <div key={tx.id} style={{ display:"grid", gridTemplateColumns:"44px 34px 1fr 78px 110px 96px 140px 72px 76px", padding:"11px 14px", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, alignItems:"center", fontFamily:F, animation:`fadeIn .2s ease ${i*0.02}s both` }}>
                    <div style={{ color:C.textMuted, fontSize:10, fontFamily:"'IBM Plex Mono',monospace" }}>#{tx.id}</div>
                    <div style={{ fontSize:17 }}>{tx.icon}</div>
                    <div style={{ color:C.text, fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tx.desc}</div>
                    <div style={{ color:C.textDim, fontSize:12 }}>{new Date(tx.date+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}</div>
                    <div><Chip color={tx.amt<0?C.red:C.accent} bg={tx.amt<0?C.redDim:C.accentDim}>{tx.cat}</Chip></div>
                    <div style={{ textAlign:"right", fontWeight:700, fontSize:13, color:tx.amt<0?C.red:C.accent, fontVariantNumeric:"tabular-nums" }}>{tx.amt<0?"−":"+"}{fmt(tx.amt)}</div>
                    <div style={{ textAlign:"center" }}>
                      {card?<span style={{ fontSize:11, padding:"3px 8px", borderRadius:99, fontWeight:600, background:`${card.clr[0]}44`, color:"#fff", border:`1px solid ${card.clr[1]}55` }}>💳 {card.name}</span>
                           :<span style={{ color:C.textMuted, fontSize:12 }}>—</span>}
                    </div>
                    <div style={{ textAlign:"center" }}><span style={{ fontSize:11, padding:"3px 8px", borderRadius:99, fontWeight:600, background:tx.src==="whatsapp"?"rgba(37,211,102,0.1)":C.blueDim, color:tx.src==="whatsapp"?C.wa:C.blue }}>{tx.src==="whatsapp"?"WA":"Man"}</span></div>
                    <div style={{ display:"flex", gap:4, justifyContent:"center" }}>
                      {editMode&&<><button onClick={()=>setEditTx(tx)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, cursor:"pointer", padding:"3px 7px", fontSize:11 }}>✏️</button>
                      <button onClick={()=>delTx(tx.id)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.red+"88", cursor:"pointer", padding:"3px 7px", fontSize:11 }}>🗑</button></>}
                    </div>
                  </div>
                );
              })
        }
      </div>
      {(editTx||addingTx)&&<TxModal tx={editTx||{date:todayStr(),desc:"",amt:"",cat:"Comida",src:"manual",cardId:null}} cards={cards} onSave={saveTx} onClose={()=>{setEditTx(null);setAddingTx(false);}}/>}
    </div>
  );
}

// ── CREDIT CARDS ──────────────────────────────────────────────────────────────
function CreditCards({ txs, cards, setCards, setTxs, msiPlans, onImportDone }) {
  const [selected,setSelected]=useState(null);
  const [editCard,setEditCard]=useState(null);
  const [adding,setAdding]=useState(false);
  const [importCard,setImportCard]=useState(null);
  const [resetting,setResetting]=useState(false);

  const handleReset=async()=>{
    if(!confirm("⚠️ ¿Borrar TODAS las transacciones, planes MSI y tarjetas?\nEsta acción no se puede deshacer.")) return;
    if(!confirm("Confirma una vez más: se borrarán todos los datos financieros de tu cuenta.")) return;
    setResetting(true);
    try{
      await API.resetDatos();
      setCards([]); setTxs([]);
    } catch(e){ console.error("Error al resetear:",e); }
    finally{ setResetting(false); }
  };

  const totUsed=cards.reduce((s,c)=>s+c.used,0), totLim=cards.reduce((s,c)=>s+c.lim,0);

  const saveCard=async(data)=>{
    try {
      if(data.id){
        const updated=await API.putTarjeta(data.id, data);
        setCards(prev=>prev.map(c=>c.id===updated.id?mapApiCard(updated):c));
      } else {
        const created=await API.postTarjeta(data);
        const mapped=mapApiCard(created);
        setCards(prev=>[...prev,mapped]);
        // Si es la primera tarjeta, asignar localmente todas las txs sin tarjeta
        setCards(prev=>{ if(prev.length===1) setTxs(p=>p.map(t=>t.cardId?t:{...t,cardId:mapped.id})); return prev; });
      }
    } catch(e){ console.error("Error guardando tarjeta:",e); }
  };

  const deleteCard=async(id)=>{
    if(!confirm("¿Eliminar esta tarjeta? Las transacciones no se borran."))return;
    try{ await API.deleteTarjeta(id); setCards(prev=>prev.filter(c=>c.id!==id)); }
    catch(e){ console.error("Error eliminando tarjeta:",e); }
  };

  return (
    <div>
      {cards.length===0
        ? <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ color:C.textMuted, fontSize:14, fontFamily:F, marginBottom:20 }}>No tienes tarjetas registradas.</div>
            <button onClick={()=>setAdding(true)} style={BtnP}>+ Agregar tarjeta</button>
          </div>
        : <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:20, marginBottom:24 }}>
              {cards.map(c=>(
                <div key={c.id} style={{ borderRadius:20, overflow:"hidden", border:`1px solid ${C.border}`, transition:"transform 0.18s, box-shadow 0.18s" }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,0.5)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
                  <div onClick={()=>setSelected(c)} style={{ background:`linear-gradient(135deg,${c.clr[0]},${c.clr[1]})`, padding:"24px 28px 20px", position:"relative", overflow:"hidden", cursor:"pointer" }}>
                    <div style={{ position:"absolute", right:-24, top:-24, width:110, height:110, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }}/>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div><div style={{ color:"rgba(255,255,255,0.55)", fontSize:10, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.12em" }}>{c.bank||"Banco"}</div><div style={{ color:"#fff", fontSize:17, fontWeight:700, fontFamily:F, marginTop:4 }}>{c.name}</div></div>
                      <div style={{ color:"rgba(255,255,255,0.8)", fontSize:26 }}>{c.icon||"💳"}</div>
                    </div>
                    <div style={{ color:"rgba(255,255,255,0.45)", fontSize:14, fontFamily:F, marginTop:18, letterSpacing:"0.18em" }}>•••• •••• •••• {c.last4}</div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:18 }}>
                      <div><div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, fontFamily:F, textTransform:"uppercase" }}>Saldo usado</div><div style={{ color:"#fff", fontSize:20, fontWeight:700, fontFamily:F }}>{fmt(c.used)}</div></div>
                      <div style={{ textAlign:"right" }}><div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, fontFamily:F, textTransform:"uppercase" }}>Límite</div><div style={{ color:"rgba(255,255,255,0.75)", fontSize:16, fontFamily:F }}>{c.lim>0?fmt(c.lim):"—"}</div></div>
                    </div>
                  </div>
                  <div style={{ background:C.card, padding:"16px 28px 18px" }}>
                    {c.lim>0&&<>
                      <ProgressBar value={c.used} max={c.lim} h={7}/>
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                        <span style={{ color:C.textMuted, fontSize:11, fontFamily:F }}>{((c.used/c.lim)*100).toFixed(0)}% utilizado</span>
                        <span style={{ color:C.textDim, fontSize:11, fontFamily:F }}>{fmt(c.lim-c.used)} disponible</span>
                      </div>
                    </>}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:c.lim>0?14:0 }}>
                      {[{lbl:"Corte",val:`Día ${c.cut}`,sub:`en ${daysTo(c.cut)} días`,col:C.yellow},{lbl:"Pago límite",val:`Día ${c.pay}`,sub:`en ${daysTo(c.pay)} días`,col:daysTo(c.pay)<=5?C.red:C.accent}].map(item=>(
                        <div key={item.lbl} style={{ background:C.surface, borderRadius:10, padding:"10px 14px" }}>
                          <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase", marginBottom:4 }}>{item.lbl}</div>
                          <div style={{ color:C.text, fontSize:13, fontFamily:F, fontWeight:600 }}>{item.val}</div>
                          <div style={{ color:item.col, fontSize:11, fontFamily:F, marginTop:2 }}>{item.sub}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:8, marginTop:12 }}>
                      <button onClick={()=>setImportCard(c)} style={{ flex:1, ...BtnP, fontSize:12, padding:"6px 0", background:C.blue }}>↑ Importar estado</button>
                    </div>
                    <div style={{ display:"flex", gap:8, marginTop:8 }}>
                      <button onClick={()=>setEditCard(c)} style={{ flex:1, ...BtnS, fontSize:12, padding:"6px 0" }}>✏️ Editar</button>
                      <button onClick={()=>deleteCard(c.id)} style={{ ...BtnS, fontSize:12, padding:"6px 12px", color:C.red, borderColor:C.red+"55" }}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {totLim>0&&<SCard style={{ marginBottom:16 }}>
              <Label>Resumen global de crédito</Label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20, marginBottom:16 }}>
                {[{lbl:"Total usado",val:fmt(totUsed),col:C.red},{lbl:"Límite total",val:fmt(totLim),col:C.text},{lbl:"Utilización global",val:`${((totUsed/totLim)*100).toFixed(0)}%`,col:(totUsed/totLim)>0.3?C.yellow:C.accent}].map(m=>(
                  <div key={m.lbl}><div style={{ color:C.textDim, fontSize:12, fontFamily:F, marginBottom:6 }}>{m.lbl}</div><div style={{ color:m.col, fontSize:22, fontWeight:700, fontFamily:F }}>{m.val}</div></div>
                ))}
              </div>
              <ProgressBar value={totUsed} max={totLim} h={8}/>
            </SCard>}
            <button onClick={()=>setAdding(true)} style={BtnP}>+ Agregar tarjeta</button>
          </>
      }
      {selected&&<CardDetailModal card={selected} txs={txs} msiPlans={msiPlans} onClose={()=>setSelected(null)}/>}
      {(adding||editCard)&&<CardModal
        card={editCard?{id:editCard.id,nombre:editCard.name,banco:editCard.bank,last4:editCard.last4,limite:editCard.lim,saldo_usado:editCard.used,dia_corte:editCard.cut,dia_pago:editCard.pay,color_inicio:editCard.clr[0],color_fin:editCard.clr[1],icono:editCard.icon}:{}}
        onSave={saveCard}
        onClose={()=>{setAdding(false);setEditCard(null);}}
      />}
      {importCard&&<ImportModal
        card={importCard}
        onDone={()=>{ setImportCard(null); onImportDone(); }}
        onClose={()=>setImportCard(null)}
      />}

      {/* Zona de peligro */}
      <div style={{ marginTop:24, padding:"16px 20px", background:C.redDim, border:`1px solid ${C.red}30`, borderRadius:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ color:C.red, fontSize:13, fontWeight:600, fontFamily:F }}>Limpiar todos mis datos</div>
          <div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginTop:2 }}>Borra transacciones, planes MSI y tarjetas. No se puede deshacer.</div>
        </div>
        <button onClick={handleReset} disabled={resetting}
          style={{ ...BtnS, color:C.red, borderColor:C.red+"55", fontSize:12, padding:"6px 16px", opacity:resetting?0.5:1, flexShrink:0 }}>
          {resetting?"Borrando…":"⚠️ Limpiar datos"}
        </button>
      </div>
    </div>
  );
}

// ── FIXED EXPENSES — grouped by priority, with benchmarks ────────────────────
function FixedExpenses({ items, setItems, income }) {
  const [editItem,setEditItem]=useState(null); const [adding,setAdding]=useState(false);
  const INCOME=income, totalFixed=items.reduce((s,f)=>s+f.amt,0);
  const pctIncome=((totalFixed/INCOME)*100).toFixed(0);

  // group by CATEGORY for item display
  const byCat=items.reduce((acc,f)=>{ (acc[f.cat]=acc[f.cat]||{total:0,items:[]}).total+=f.amt; acc[f.cat].items.push(f); return acc; },{});
  // group by PRIORITY for the donut
  const byPri=items.reduce((acc,f)=>{ const p=FIXED_CAT_PRI[f.cat]||"Flexible"; (acc[p]=acc[p]||0); acc[p]+=f.amt; return acc; },{});
  const pieDat=PRIORITIES.map(p=>({ name:p, value:byPri[p]||0, color:PM[p].color }));
  const catCol={
    Vivienda:"#3D8EF5", Salud:"#00D4A0", Servicios:"#FFBA2C",
    Transporte:"#22D3EE", Seguros:"#9B7BFF",
    Inversión:"#00D4A0", Gimnasio:"#FF6B6B", Celular:"#3D8EF5",
    Telecom:"#7C3AED", "Trabajo / Consulta":"#06B6D4", Educación:"#F59E0B",
    Entretenimiento:"#EC4899", Suscripciones:"#8B5CF6",
    Ropa:"#F97316", Otros:"#6B8CA8",
  };

  const saveItem=async(item)=>{
    const payload={ detalle:item.name, monto:item.amt, grupo:item.cat, icono:item.icon, dia_cobro:item.day };
    if(item.id&&items.find(i=>i.id===item.id)){
      const updated=await API.putFijo(item.id, payload).catch(console.error);
      if(updated) setItems(p=>p.map(i=>i.id===item.id?mapApiFijo(updated,0):i));
    } else {
      const created=await API.postFijo(payload).catch(console.error);
      if(created) setItems(p=>[...p, mapApiFijo(created, p.length)]);
    }
  };
  const delItem=async(id)=>{
    if(!confirm("¿Eliminar este gasto fijo?"))return;
    await API.deleteFijo(id).catch(console.error);
    setItems(p=>p.filter(i=>i.id!==id));
  };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        {[{lbl:"Total comprometido",val:fmt(totalFixed),col:C.red},{lbl:"% del ingreso",val:`${pctIncome}%`,col:+pctIncome>50?C.red:C.yellow},{lbl:"Ingreso mensual",val:fmt(INCOME),col:C.accent},{lbl:"Disponible restante",val:fmt(INCOME-totalFixed),col:C.blue}].map(m=>(
          <SCard key={m.lbl} style={{ padding:"16px 18px" }}>
            <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>{m.lbl}</div>
            <div style={{ color:m.col, fontSize:20, fontWeight:700, fontFamily:F }}>{m.val}</div>
          </SCard>
        ))}
      </div>

      {/* Donut by priority group */}
      <SCard style={{ marginBottom:24 }}>
        <Label>Distribución por prioridad de gasto fijo</Label>
        <PieDistrib data={pieDat.filter(d=>d.value>0)}/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:20 }}>
          {PRIORITIES.map(p=>{
            const amt=byPri[p]||0, bm=GROUP_BM[p], bmAmt=bm.pct/100*INCOME, meta=PM[p];
            const over=amt>bmAmt;
            return (
              <div key={p} style={{ background:meta.bg, border:`1px solid ${meta.color}25`, borderRadius:12, padding:"12px 14px" }}>
                <div style={{ color:meta.color, fontSize:12, fontWeight:700, fontFamily:F, marginBottom:6 }}>{p}</div>
                <div style={{ color:over?C.red:C.text, fontSize:15, fontWeight:700, fontFamily:F }}>{fmt(amt)}</div>
                <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, marginBottom:6 }}>ref: {fmt(bmAmt)} ({bm.pct}%) · {bm.desc}</div>
                <BenchmarkBar value={amt} benchmark={bmAmt} color={meta.color} h={4}/>
              </div>
            );
          })}
        </div>
      </SCard>

      {/* List by category with benchmark bars */}
      {Object.entries(byCat).map(([cat,d])=>{
        const bm=CAT_BM[cat], bmAmt=bm?(bm.pct/100*INCOME):null;
        const pctInc=(d.total/INCOME*100).toFixed(1);
        const col=catCol[cat]||C.purple;
        const over=bmAmt&&d.total>bmAmt;
        return (
          <div key={cat} style={{ marginBottom:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:4, height:16, borderRadius:2, background:col }}/>
                <span style={{ color:C.text, fontFamily:F, fontWeight:600, fontSize:14 }}>{cat}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ color:over?C.red:C.textDim, fontSize:12, fontFamily:F }}>{pctInc}% del ingreso{over?` — excede ref. ${bm.pct}%`:""}</span>
                <span style={{ color:over?C.red:col, fontFamily:F, fontWeight:700, fontSize:14 }}>{fmt(d.total)}/mes</span>
              </div>
            </div>
            {bmAmt&&<div style={{ marginBottom:10 }}>
              <BenchmarkBar value={d.total} benchmark={bmAmt} color={col} h={5}/>
              <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, marginTop:2 }}>Línea amarilla = referencia ({bm.pct}% · {bm.desc})</div>
            </div>}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {d.items.map(item=>{
                const pri=FIXED_CAT_PRI[item.cat]||"Flexible", metaI=PM[pri];
                const itemCol=catCol[item.cat]||col;
                return (
                <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 18px", background:`${itemCol}10`, borderLeft:`4px solid ${itemCol}`, border:`1px solid ${itemCol}25`, borderRadius:12, fontFamily:F }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:18 }}>{item.icon}</span>
                    <div>
                      <div style={{ color:C.text, fontSize:14 }}>{item.name}</div>
                      <Chip color={metaI.color} bg={`${metaI.color}18`}>{pri}</Chip>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <span style={{ color:C.textDim, fontSize:12 }}>Día {item.day}</span>
                    <span style={{ color:itemCol, fontWeight:700, fontSize:14 }}>{fmt(item.amt)}</span>
                    <button onClick={()=>setEditItem(item)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, cursor:"pointer", padding:"3px 8px", fontSize:12 }}>✏️</button>
                    <button onClick={()=>delItem(item.id)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, cursor:"pointer", padding:"3px 8px", fontSize:12 }}>🗑</button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        );
      })}
      <button onClick={()=>setAdding(true)} style={{ ...BtnP, marginTop:4 }}>+ Añadir gasto fijo</button>
      {(editItem||adding)&&<FixedModal item={editItem||{name:"",amt:"",cat:"Servicios",icon:"💡",day:1}} onSave={saveItem} onClose={()=>{setEditItem(null);setAdding(false);}}/>}
    </div>
  );
}

// ── MSI ───────────────────────────────────────────────────────────────────────
function MSIPlans({ plans, cards }) {
  const totalMo=plans.reduce((s,p)=>s+p.mo,0), totalDebt=plans.reduce((s,p)=>s+(p.total-p.paid*p.mo),0);
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
        {[{lbl:"Deuda total MSI",val:fmt(totalDebt),col:C.red},{lbl:"Cuota mensual total",val:fmt(totalMo),col:C.yellow},{lbl:"Planes activos",val:plans.length,col:C.accent}].map(m=>(
          <SCard key={m.lbl} style={{ padding:"16px 18px" }}>
            <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>{m.lbl}</div>
            <div style={{ color:m.col, fontSize:22, fontWeight:700, fontFamily:F }}>{m.val}</div>
          </SCard>
        ))}
      </div>
      {plans.map(plan=>{
        const pct=(plan.paid/plan.months)*100, rem=plan.total-plan.paid*plan.mo;
        const next=new Date(plan.start); next.setMonth(next.getMonth()+plan.paid+1);
        const card=cards.find(c=>c.id===plan.cardId);
        return (
          <SCard key={plan.id} style={{ marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
              <div>
                <div style={{ color:C.text, fontFamily:F, fontWeight:600, fontSize:16 }}>{plan.name}</div>
                <div style={{ color:C.textDim, fontFamily:F, fontSize:12, marginTop:4, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                  {plan.store} · {plan.months} MSI
                  {card&&<span style={{ fontSize:11, padding:"2px 8px", borderRadius:99, fontWeight:600, background:`${card.clr[0]}44`, color:"#fff", border:`1px solid ${card.clr[1]}55` }}>💳 {card.name}</span>}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:C.accent, fontFamily:F, fontWeight:700, fontSize:18 }}>{fmt(plan.mo)}/mes</div>
                <div style={{ color:C.textMuted, fontFamily:F, fontSize:12 }}>Saldo: {fmt(rem)}</div>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ color:C.textDim, fontFamily:F, fontSize:13 }}>{plan.paid} de {plan.months} cuotas</span>
              <span style={{ color:C.accent, fontFamily:F, fontSize:13, fontWeight:700 }}>{pct.toFixed(0)}%</span>
            </div>
            <ProgressBar value={plan.paid} max={plan.months} h={8}/>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginTop:14 }}>
              {[{lbl:"Próximo pago",val:next.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"}),col:C.accent,bg:C.accentDim},{lbl:"Cuotas restantes",val:`${plan.months-plan.paid} pagos`,col:C.text,bg:C.surface},{lbl:"Precio original",val:fmt(plan.total),col:C.textDim,bg:C.surface}].map(item=>(
                <div key={item.lbl} style={{ background:item.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px" }}>
                  <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase", marginBottom:4 }}>{item.lbl}</div>
                  <div style={{ color:item.col, fontSize:13, fontFamily:F, fontWeight:600 }}>{item.val}</div>
                </div>
              ))}
            </div>
          </SCard>
        );
      })}
    </div>
  );
}

// ── ESTADO ────────────────────────────────────────────────────────────────────
function Estado({ txs, groupBudgets, fixedItems, income, msiPlans, prevSavings, cards }) {
  const [savingsGoalPct, setSavingsGoalPct] = useState(20);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("20");
  const INCOME    = income;
  const totalFixed = fixedItems.reduce((s,f)=>s+f.amt, 0);
  const totalMSI   = msiPlans.filter(p=>p.paid<p.months).reduce((s,p)=>s+p.mo, 0);
  const committed  = totalFixed + totalMSI;
  const committedR = INCOME>0 ? committed/INCOME : 0;

  const gastoVar      = txs.filter(t=>t.amt<0&&t.cat!=="Ahorro").reduce((s,t)=>s+Math.abs(t.amt), 0);
  const thisMoSavings = txs.filter(t=>t.cat==="Ahorro").reduce((s,t)=>s+Math.abs(t.amt), 0);
  const totalPresup   = Object.values(groupBudgets).reduce((s,v)=>s+v, 0);
  const librePresup   = totalPresup - gastoVar;
  const posibleAhorro = Math.max(0, INCOME - committed - totalPresup);
  const savR          = INCOME>0 ? thisMoSavings/INCOME : 0;
  const totUsed       = cards.reduce((s,c)=>s+c.used, 0);
  const totLim        = cards.reduce((s,c)=>s+c.lim, 0);
  const creditUtil    = totLim>0 ? totUsed/totLim : 0;

  // Promedio ponderado de meses restantes en MSI
  const msiTotalCommit = msiPlans.reduce((s,p)=>s+p.mo*(p.months-p.paid), 0);
  const msiAvgMonths   = totalMSI>0 ? Math.round(msiTotalCommit/totalMSI) : 0;

  const savRate = Math.round(Math.max(0, INCOME-committed-gastoVar)/Math.max(INCOME,1)*100);
  const spentByGroup = txs.reduce((acc,tx)=>{ if(tx.amt>=0)return acc; const g=CAT_GROUP[tx.cat]; if(!g)return acc; acc[g]=(acc[g]||0)+Math.abs(tx.amt); return acc; },{});
  const factors = [
    { label:"Compromisos del ingreso", detail:`${Math.round(committedR*100)}% fijos+MSI`,  pts:committedR<0.50?25:committedR<0.65?15:5, maxPts:25 },
    { label:"Tasa libre mensual",      detail:`${savRate}% disponible`,                    pts:savRate>20?25:savRate>10?15:5,            maxPts:25 },
    { label:"Utilización de crédito",  detail:`${Math.round(creditUtil*100)}% del límite`, pts:creditUtil<0.30?25:creditUtil<0.50?15:5,  maxPts:25 },
    { label:"Ahorro del mes",          detail:`${Math.round(savR*100)}% del ingreso`,      pts:savR>0.10?25:savR>0.05?15:5,             maxPts:25 },
  ];
  const score = Math.min(100, factors.reduce((s,f)=>s+f.pts, 0));

  // Alertas financieras
  const alertsEstado = [
    totalPresup>0 && gastoVar > totalPresup
      ? { type:"danger", msg:"Presupuesto mensual excedido", sub:`Excediste por ${fmt(gastoVar-totalPresup)}` }
      : totalPresup>0 && gastoVar > totalPresup*0.85
      ? { type:"warn",   msg:"Próximo a agotar el presupuesto", sub:`Quedan ${fmt(totalPresup-gastoVar)} (${Math.round((1-gastoVar/totalPresup)*100)}%)` }
      : null,
    committedR>0.50
      ? { type:"danger", msg:`Compromisos > 50% del ingreso (${Math.round(committedR*100)}%)`, sub:`${fmt(committed)} comprometidos de ${fmt(INCOME)}` }
      : committedR>0.35
      ? { type:"warn",   msg:`Compromisos al ${Math.round(committedR*100)}% del ingreso`, sub:"Zona de precaución (recomendado < 35%)" }
      : null,
    INCOME>0 && totalFixed/INCOME > 0.40
      ? { type:"warn", msg:`Gastos fijos = ${Math.round(totalFixed/INCOME*100)}% del ingreso`, sub:"Se recomienda no exceder el 40%" }
      : null,
    msiPlans.length>0
      ? { type:"info", msg:`MSI: ${Math.round(totalMSI/Math.max(INCOME,1)*100)}% del ingreso por ~${msiAvgMonths} mes${msiAvgMonths!==1?"es":""}`, sub:`${fmt(totalMSI)}/mes en ${msiPlans.length} plan${msiPlans.length>1?"es":""}` }
      : null,
  ].filter(Boolean);

  const spentByCat = txs.filter(t=>t.amt<0&&t.cat!=="Ahorro").reduce((acc,tx)=>{ acc[tx.cat]=(acc[tx.cat]||0)+Math.abs(tx.amt); return acc; },{});
  const diasCorte = cards.length>0 ? Math.min(...cards.map(c=>daysTo(c.cut))) : null;
  const activeMsi = msiPlans.filter(p=>p.paid<p.months);
  const libreTotal = Math.max(0, INCOME - committed - gastoVar);
  const msiSaldoTotal = activeMsi.reduce((s,p)=>s+(p.total-p.paid*p.mo), 0);
  const nonMsiUsed = Math.max(0, totUsed - msiSaldoTotal);
  const liquidezRatio = gastoVar>0 ? libreTotal/gastoVar : 0;
  const msiVelocidad = INCOME>0 ? msiSaldoTotal/INCOME : 0;
  const dominantGroup = Object.entries(spentByGroup).sort((a,b)=>b[1]-a[1])[0]||["—",0];
  const histLast3Avg = EXPENSE_TREND_RAW.slice(-4,-1).reduce((s,r)=>s+EXP_CATS.reduce((ss,c)=>ss+(r[c]||0),0),0)/3;
  const tendenciaDiff = histLast3Avg>0?(gastoVar-histLast3Avg)/histLast3Avg:0;

  const porCategoria = Object.entries(spentByCat).map(([categoria,total])=>({categoria,total}));
  const presupuesto  = Object.entries(GRUPOS).flatMap(([grp,{cats}])=>
    cats.map(cat=>({ categoria:cat, monto:(groupBudgets[grp]||0)/cats.length }))
  );
  const msiActivosApi = activeMsi.map(p=>({
    id:p.id, descripcion:p.name,
    pagos_hechos:p.paid, total_pagos:p.months,
    pagos_restantes:p.months-p.paid,
    cuota_mensual:p.mo,
    saldo_pendiente:p.mo*(p.months-p.paid),
    proxima_cuota:new Date(new Date(p.start).setMonth(new Date(p.start).getMonth()+p.paid+1)).toISOString().slice(0,10),
  }));
  const d = {
    porCategoria, presupuesto,
    libre:      libreTotal,
    acumulado:  prevSavings + thisMoSavings,
    msiActivos: msiActivosApi,
    cuotasMSI:  activeMsi.reduce((s,p)=>s+p.mo,0),
    totLim,
    totUsed,
    ahorroMensual: thisMoSavings > 0 ? thisMoSavings : AHORRO_MENSUAL,
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* ── 1. KPI BAR ───────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
        {[
          { lbl:"Ingreso mensual",  val:fmt(INCOME),     col:C.accent,  sub:null },
          { lbl:"Gastos fijos",     val:fmt(totalFixed), col:C.red,     sub:INCOME>0?`${Math.round(totalFixed/INCOME*100)}% del ingreso`:null },
          { lbl:"MSI / mes",        val:fmt(totalMSI),   col:C.yellow,  sub:INCOME>0?`${Math.round(totalMSI/INCOME*100)}% del ingreso`:null },
          { lbl:"Gastado variable", val:fmt(gastoVar),   col:C.blue,    sub:INCOME>0?`${Math.round(gastoVar/INCOME*100)}% del ingreso`:null },
          { lbl:"Saldo libre",      val:fmt(libreTotal), col:libreTotal<=0?C.red:C.accent, sub:null },
        ].map(k=>(
          <div key={k.lbl} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 20px", display:"flex", flexDirection:"column", gap:6 }}>
            <span style={{ color:C.textMuted, fontSize:10, fontFamily:F, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>{k.lbl}</span>
            <span style={{ color:k.col, fontSize:26, fontWeight:700, fontFamily:F, lineHeight:1.1 }}>{k.val}</span>
            {k.sub&&<span style={{ color:C.textMuted, fontSize:11, fontFamily:F }}>{k.sub}</span>}
          </div>
        ))}
      </div>

      {/* ── 2. SCORE FINANCIERO ──────────────────────────────────────────── */}
      <SCard style={{ padding:"20px 24px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"35% 65%", alignItems:"stretch" }}>

          {/* Gauge izquierda */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingRight:24, borderRight:`1px solid ${C.border}` }}>
            <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Score financiero</div>
            <ScoreGauge score={score} w={190} h={143}/>
          </div>

          {/* 5 indicadores financieros */}
          <div style={{ paddingLeft:24, minWidth:300 }}>
            <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 }}>Indicadores financieros</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {/* 1 — % Comprometido */}
              {(()=>{
                const col=committedR>0.50?C.red:committedR>=0.40?C.yellow:C.accent;
                return (
                  <div style={{ background:C.surface, borderRadius:10, padding:"8px 10px" }}>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>% Comprometido</div>
                    <div style={{ color:col, fontSize:18, fontWeight:700, fontFamily:F, lineHeight:1.1 }}>{Math.round(committedR*100)}%</div>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F, marginTop:2 }}>de tu ingreso ya está asignado</div>
                  </div>
                );
              })()}
              {/* 2 — Categoría dominante */}
              {(()=>{
                const [grp, amt]=dominantGroup;
                const col=grp==="Esencial"?C.red:grp==="Importante"?C.yellow:grp==="Flexible"?C.blue:C.textDim;
                return (
                  <div style={{ background:C.surface, borderRadius:10, padding:"8px 10px" }}>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Categoría dominante</div>
                    <div style={{ color:col, fontSize:13, fontWeight:700, fontFamily:F, lineHeight:1.1 }}>{grp}</div>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F, marginTop:2 }}>{fmt(amt)} · mayor concentración</div>
                  </div>
                );
              })()}
              {/* 3 — Índice de liquidez */}
              {(()=>{
                const lbl=liquidezRatio>3?"Alta":liquidezRatio>1?"Media":"Baja";
                const col=liquidezRatio>3?C.accent:liquidezRatio>1?C.yellow:C.red;
                return (
                  <div style={{ background:C.surface, borderRadius:10, padding:"8px 10px" }}>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Liquidez</div>
                    <div style={{ color:col, fontSize:18, fontWeight:700, fontFamily:F, lineHeight:1.1 }}>{lbl} <span style={{ fontSize:12 }}>({liquidezRatio.toFixed(1)}x)</span></div>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F, marginTop:2 }}>meses cubiertos con excedente</div>
                  </div>
                );
              })()}
              {/* 4 — Velocidad de deuda MSI */}
              {(()=>{
                const col=msiVelocidad>6?C.red:msiVelocidad>3?C.yellow:C.accent;
                return (
                  <div style={{ background:C.surface, borderRadius:10, padding:"8px 10px" }}>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Velocidad MSI</div>
                    <div style={{ color:col, fontSize:18, fontWeight:700, fontFamily:F, lineHeight:1.1 }}>{msiVelocidad.toFixed(1)}<span style={{ fontSize:12 }}> mes</span></div>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F, marginTop:2 }}>meses de ingreso en deuda MSI</div>
                  </div>
                );
              })()}
            </div>
            {/* 5 — Tendencia de gasto (ancho completo) */}
            {(()=>{
              const arriba=tendenciaDiff>0;
              const col=arriba?C.red:C.accent;
              const pct=Math.abs(tendenciaDiff*100).toFixed(0);
              return (
                <div style={{ background:C.surface, borderRadius:10, padding:"8px 10px", marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Tendencia de gasto</div>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F }}>vs promedio últimos 3 meses</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:col, fontSize:22, fontWeight:700, fontFamily:F, lineHeight:1 }}>{arriba?"↑":"↓"}{pct}%</div>
                    <div style={{ color:C.textMuted, fontSize:9, fontFamily:F }}>{arriba?"Por encima":"Por debajo"} del promedio</div>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      </SCard>

      <SeccionPresupuesto porCategoria={d.porCategoria} presupuesto={d.presupuesto}/>
      <SeccionAhorroMSI dash={d}/>

    </div>
  );
}

// ── BUDGET — with benchmark references per group ──────────────────────────────
function Budget({ groupBudgets, setGroupBudgets, income, txs }) {
  const [cats,setCats]=useState(()=>BUDGET_CATS_DEFAULT.map(c=>({...c,priority:c.defaultP})));
  const [editGroup,setEditGroup]=useState(null); const [tempVal,setTempVal]=useState("");
  const [collapsed,setCollapsed]=useState({}); const [showPct,setShowPct]=useState(false);
  const INCOME=income;
  const totalBudget=Object.values(groupBudgets).reduce((s,v)=>s+v,0), remaining=INCOME-totalBudget;
  const spentByGroup=txs.reduce((acc,tx)=>{ if(tx.amt>=0)return acc; const g=CAT_GROUP[tx.cat]; if(!g)return acc; acc[g]=(acc[g]||0)+Math.abs(tx.amt); return acc; },{});
  const saveGroup=p=>{ const v=parseFloat(tempVal); if(!isNaN(v)&&v>=0) setGroupBudgets(prev=>({...prev,[p]:showPct?Math.round(v/100*INCOME):v})); setEditGroup(null); };
  const updateP=(id,p)=>setCats(prev=>prev.map(c=>c.id===id?{...c,priority:p}:c));
  const displayBudget=v=>showPct?`${Math.round(v/INCOME*100)}%`:fmt(v);
  const pieDat=PRIORITIES.map(p=>({ name:p, value:groupBudgets[p]||0, color:PM[p].color }));

  const mes = new Date().toLocaleDateString("es-MX",{month:"long",year:"numeric"});

  return (
    <div>
      {/* Presupuesto por prioridad — gastado vs asignado */}
      <SCard style={{ marginBottom:24 }}>
        <Label>{mes.charAt(0).toUpperCase()+mes.slice(1)} — Real vs presupuesto por prioridad</Label>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
          {PRIORITIES.map(p=>{
            const budget=groupBudgets[p]||0, actual=spentByGroup[p]||0;
            const pct=budget>0?(actual/budget)*100:0, meta=PM[p];
            return (
              <div key={p} style={{ background:meta.bg, border:`1px solid ${meta.color}30`, borderRadius:14, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                  <div style={{ width:4, height:14, borderRadius:2, background:meta.color }}/>
                  <span style={{ color:meta.color, fontSize:12, fontWeight:700, fontFamily:F }}>{p}</span>
                </div>
                <div style={{ color:pct>100?C.red:meta.color, fontSize:20, fontWeight:700, fontFamily:F, marginBottom:2 }}>{fmt(actual)}</div>
                <div style={{ color:C.textDim, fontSize:11, fontFamily:F, marginBottom:8 }}>de {fmt(budget)} · {pct.toFixed(0)}%</div>
                <ProgressBar value={actual} max={budget||1} color={meta.color} h={5}/>
                <div style={{ color:pct>100?C.red:pct>80?C.yellow:C.accent, fontSize:10, fontFamily:F, marginTop:5, fontWeight:600 }}>
                  {pct>100?"Excedido":pct>80?"En riesgo":pct>50?"En curso":"Bajo control"}
                </div>
              </div>
            );
          })}
        </div>
      </SCard>

      <SCard style={{ marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <Label>Distribución por prioridad</Label>
          <div style={{ display:"flex", background:C.surface, borderRadius:8, padding:3, border:`1px solid ${C.border}` }}>
            {[["$","Monto"],["%","Porcentaje"]].map(([v])=>{ const on=(v==="%")===showPct; return <button key={v} onClick={()=>setShowPct(v==="%")} style={{ padding:"4px 12px", borderRadius:6, fontSize:12, fontFamily:F, fontWeight:600, background:on?C.accent:"transparent", color:on?C.bg:C.textDim, border:"none", cursor:"pointer" }}>{v}</button>; })}
          </div>
        </div>
        <PieDistrib data={pieDat.filter(d=>d.value>0)}/>
      </SCard>

      {PRIORITIES.map(priority=>{
        const group=cats.filter(c=>c.priority===priority);
        const meta=PM[priority], budget=groupBudgets[priority]||0, isCollapsed=collapsed[priority];
        const bmAmt=GROUP_BM[priority].pct/100*INCOME;
        const over=budget>bmAmt*1.2;
        return (
          <div key={priority} style={{ marginBottom:20 }}>
            {/* Cabecera del grupo — editable, con benchmark */}
            <div style={{ background:meta.bg, border:`1px solid ${meta.color}30`, borderRadius:12, padding:"14px 18px", marginBottom:isCollapsed?0:10 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:4, height:18, borderRadius:2, background:meta.color }}/>
                  <span style={{ color:meta.color, fontWeight:700, fontSize:14, fontFamily:F }}>{priority}</span>
                  <span style={{ color:C.textMuted, fontSize:12, fontFamily:F }}>{group.length} categorías</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  {editGroup===priority
                    ? <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <input autoFocus value={tempVal} onChange={e=>setTempVal(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter")saveGroup(priority); if(e.key==="Escape")setEditGroup(null); }} style={{ width:110, background:C.card, border:`1px solid ${meta.color}`, borderRadius:8, padding:"5px 10px", color:meta.color, fontFamily:F, fontSize:14, fontWeight:600, outline:"none", textAlign:"right" }}/>
                        <button onClick={()=>saveGroup(priority)} style={{ ...BtnP, padding:"5px 10px" }}>✓</button>
                      </div>
                    : <div onClick={()=>{ setEditGroup(priority); setTempVal(showPct?Math.round(budget/INCOME*100).toString():budget.toString()); }} style={{ color:meta.color, fontWeight:700, fontSize:15, fontFamily:F, cursor:"pointer", padding:"5px 14px", borderRadius:8, background:`${meta.color}15`, border:`1px solid ${meta.color}30` }}>{displayBudget(budget)}/mes</div>
                  }
                  <button onClick={()=>setCollapsed(prev=>({...prev,[priority]:!prev[priority]}))} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.textMuted, fontSize:13, padding:"4px 6px" }}>{isCollapsed?"▶":"▼"}</button>
                </div>
              </div>
              {/* Benchmark bar — igual que FixedExpenses */}
              <BenchmarkBar value={budget} benchmark={bmAmt} color={meta.color} h={4}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span style={{ color:C.textMuted, fontSize:10, fontFamily:F }}>Ref. {GROUP_BM[priority].pct}% · {GROUP_BM[priority].desc}</span>
                <span style={{ color:over?C.red:C.textMuted, fontSize:10, fontFamily:F, fontWeight:600 }}>{over?"Excede referencia":""}</span>
              </div>
            </div>
            {!isCollapsed&&<div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {group.map(cat=>(
                <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 18px", background:meta.bg, border:`1px solid ${meta.color}20`, borderRadius:12, fontFamily:F }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{cat.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:C.text, fontSize:14, fontWeight:500 }}>{cat.name}</div>
                    <div style={{ color:C.textMuted, fontSize:11, marginTop:2, lineHeight:1.4 }}>{cat.desc}</div>
                  </div>
                  <select value={cat.priority} onChange={e=>updateP(cat.id,e.target.value)} style={{ background:PM[cat.priority].bg, border:`1px solid ${PM[cat.priority].color}50`, color:PM[cat.priority].color, borderRadius:99, padding:"4px 10px", fontSize:11, fontFamily:F, cursor:"pointer", outline:"none", fontWeight:600, flexShrink:0 }}>
                    {PRIORITIES.map(p=><option key={p} value={p} style={{ background:C.card, color:C.text }}>{p}</option>)}
                  </select>
                </div>
              ))}
            </div>}
          </div>
        );
      })}
    </div>
  );
}


// ── ONBOARDING WIZARD ─────────────────────────────────────────────────────────
const GRUPOS_FIJO = ["Vivienda","Salud","Servicios","Gimnasio","Entretenimiento","Telecom","Inversión","Trabajo / Consulta","Celular","Otros"];
const PASOS_WZ   = ["💰 Ingresos","📄 Estados de cuenta","📌 Gastos fijos","🎯 Presupuesto"];

function OnboardingWizard({ onDone, defaultGroupBudgets }) {
  const [paso,setPaso]=useState(0);
  const [ingresos,setIngresos]=useState([]);
  const [nConcepto,setNConcepto]=useState(""); const [nMonto,setNMonto]=useState("");
  const [archivo,setArchivo]=useState(null); const [importResult,setImportResult]=useState(null);
  const [uploadBusy,setUploadBusy]=useState(false);
  const [fijos,setFijos]=useState([]); const [fErr,setFErr]=useState("");
  const [fConcepto,setFConcepto]=useState(""); const [fMonto,setFMonto]=useState(""); const [fGrupo,setFGrupo]=useState("Vivienda");
  const [grupos,setGrupos]=useState(defaultGroupBudgets);
  const [busy,setBusy]=useState(false); const [err,setErr]=useState("");

  useEffect(()=>{
    API.getIngresos().then(setIngresos).catch(()=>{});
    API.getFijos().then(d=>setFijos(d.fijos||[])).catch(()=>{});
  },[]);

  const addIngreso=async()=>{
    if(!nConcepto||!nMonto)return;
    try{ const r=await API.postIngreso({concepto:nConcepto,monto:parseFloat(nMonto)}); setIngresos(p=>[...p,r]); setNConcepto(""); setNMonto(""); }
    catch(e){ setErr(e.message); }
  };
  const rmIngreso=async id=>{ await API.deleteIngreso(id); setIngresos(p=>p.filter(i=>i.id!==id)); };

  const importarCSV=async()=>{
    if(!archivo)return; setUploadBusy(true); setFErr("");
    try{ const t=await archivo.text(); const r=await API.importCSV(t); setImportResult(r); }
    catch(e){ setFErr(e.message); } finally{ setUploadBusy(false); }
  };

  const addFijo=async()=>{
    if(!fConcepto||!fMonto)return;
    try{ const r=await API.postFijo({detalle:fConcepto,monto:parseFloat(fMonto),grupo:fGrupo}); setFijos(p=>[...p,r]); setFConcepto(""); setFMonto(""); }
    catch(e){ setFErr(e.message); }
  };
  const rmFijo=async id=>{ await API.deleteFijo(id); setFijos(p=>p.filter(f=>f.id!==id)); };

  const finalizar=async()=>{
    setBusy(true);
    try{ await Promise.all(Object.entries(grupos).map(([p,m])=>API.putPresupuestoGrupo(p,m))); onDone(); }
    catch(e){ setErr(e.message); } finally{ setBusy(false); }
  };

  const IS2={background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:F};
  const nextDisabled=paso===0&&ingresos.length===0;

  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:C.bg,fontFamily:F,padding:24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ width:"100%",maxWidth:560 }}>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
          <div style={{ width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${C.accent},#00A882)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>◈</div>
          <div>
            <div style={{ color:C.text,fontWeight:700,fontSize:18 }}>Configurar ClarIA</div>
            <div style={{ color:C.textMuted,fontSize:12 }}>{PASOS_WZ[paso]}</div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div style={{ display:"flex",gap:6,marginBottom:24 }}>
          {PASOS_WZ.map((_,i)=><div key={i} style={{ flex:1,height:4,borderRadius:99,background:i<=paso?C.accent:C.border,transition:"background 0.3s" }}/>)}
        </div>

        {/* Card del paso */}
        <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:"28px 32px" }}>

          {/* PASO 0 — Ingresos */}
          {paso===0&&<>
            <div style={{ color:C.text,fontSize:16,fontWeight:600,marginBottom:4 }}>¿Cuáles son tus ingresos?</div>
            <div style={{ color:C.textMuted,fontSize:13,marginBottom:20 }}>Agrega todos: salario, freelance, renta, negocio…</div>
            {ingresos.map(i=>(
              <div key={i.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:C.surface,borderRadius:10,marginBottom:8 }}>
                <div>
                  <div style={{ color:C.text,fontSize:13,fontWeight:500 }}>{i.concepto}</div>
                  <div style={{ color:C.accent,fontSize:13,fontWeight:700 }}>{fmt(i.monto)}/mes</div>
                </div>
                <button onClick={()=>rmIngreso(i.id)} style={{ background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:18 }}>✕</button>
              </div>
            ))}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 110px auto",gap:8,marginTop:12 }}>
              <input value={nConcepto} onChange={e=>setNConcepto(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addIngreso()} placeholder="Ej: Salario, Freelance, Renta" style={IS2}/>
              <input value={nMonto} onChange={e=>setNMonto(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addIngreso()} type="number" placeholder="Monto" style={IS2}/>
              <button onClick={addIngreso} style={{ background:C.accent,border:"none",borderRadius:8,color:C.bg,padding:"0 16px",cursor:"pointer",fontWeight:600,fontSize:13 }}>+ Agregar</button>
            </div>
          </>}

          {/* PASO 1 — Estados de cuenta */}
          {paso===1&&<>
            <div style={{ color:C.text,fontSize:16,fontWeight:600,marginBottom:4 }}>Importa tus estados de cuenta</div>
            <div style={{ color:C.textMuted,fontSize:13,marginBottom:20 }}>Sube los CSVs de tus tarjetas BBVA. Puedes importar varias.</div>
            {importResult&&(
              <div style={{ background:C.accentDim,border:`1px solid ${C.accent}30`,borderRadius:12,padding:"14px 18px",marginBottom:14 }}>
                <div style={{ color:C.accent,fontWeight:700,fontSize:13 }}>✅ {importResult.transacciones} transacciones importadas</div>
                {importResult.msi>0&&<div style={{ color:C.textDim,fontSize:12,marginTop:4 }}>{importResult.msi} planes MSI detectados</div>}
              </div>
            )}
            <label style={{ display:"flex",alignItems:"center",gap:12,padding:16,background:C.surface,border:`2px dashed ${archivo?C.accent:C.border}`,borderRadius:12,cursor:"pointer",marginBottom:10 }}>
              <span style={{ fontSize:22 }}>📄</span>
              <div>
                <div style={{ color:archivo?C.accent:C.textDim,fontSize:13,fontWeight:500 }}>{archivo?archivo.name:"Seleccionar CSV"}</div>
                <div style={{ color:C.textMuted,fontSize:11 }}>Formato BBVA · .csv</div>
              </div>
              <input type="file" accept=".csv" style={{ display:"none" }} onChange={e=>{setArchivo(e.target.files[0]);setImportResult(null);}}/>
            </label>
            {archivo&&<button onClick={importarCSV} disabled={uploadBusy} style={{ width:"100%",background:C.accent,border:"none",borderRadius:10,color:C.bg,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:8 }}>
              {uploadBusy?"Importando…":"Importar"}
            </button>}
            {fErr&&<div style={{ color:C.red,fontSize:12,marginTop:8 }}>{fErr}</div>}
          </>}

          {/* PASO 2 — Gastos fijos */}
          {paso===2&&<>
            <div style={{ color:C.text,fontSize:16,fontWeight:600,marginBottom:4 }}>Gastos fijos mensuales</div>
            <div style={{ color:C.textMuted,fontSize:13,marginBottom:20 }}>Lo que pagas siempre: renta, gym, suscripciones…</div>
            {fijos.length>0&&<div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:16 }}>
              {fijos.map(f=>(
                <div key={f.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:C.surface,borderRadius:10 }}>
                  <div>
                    <div style={{ color:C.text,fontSize:13,fontWeight:500 }}>{f.detalle||f.nombre}</div>
                    <div style={{ color:C.textMuted,fontSize:11 }}>{f.grupo||f.categoria||"—"}</div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ color:C.accent,fontSize:13,fontWeight:700 }}>{fmt(f.monto)}</span>
                    <button onClick={()=>rmFijo(f.id)} style={{ background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:18 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 90px 130px auto",gap:8 }}>
              <input value={fConcepto} onChange={e=>setFConcepto(e.target.value)} placeholder="Renta, Netflix…" style={IS2}/>
              <input value={fMonto} onChange={e=>setFMonto(e.target.value)} type="number" placeholder="Monto" style={IS2}/>
              <select value={fGrupo} onChange={e=>setFGrupo(e.target.value)} style={{ ...IS2,cursor:"pointer" }}>
                {GRUPOS_FIJO.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <button onClick={addFijo} style={{ background:C.accent,border:"none",borderRadius:8,color:C.bg,padding:"0 14px",cursor:"pointer",fontWeight:600,fontSize:13 }}>+</button>
            </div>
            {fErr&&<div style={{ color:C.red,fontSize:12,marginTop:8 }}>{fErr}</div>}
          </>}

          {/* PASO 3 — Presupuesto */}
          {paso===3&&<>
            <div style={{ color:C.text,fontSize:16,fontWeight:600,marginBottom:4 }}>Define tu presupuesto</div>
            <div style={{ color:C.textMuted,fontSize:13,marginBottom:20 }}>¿Cuánto quieres destinar a cada prioridad al mes?</div>
            {PRIORITIES.map(p=>(
              <div key={p} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:C.surface,borderRadius:10,marginBottom:8 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:PM[p].color }}/>
                  <span style={{ color:C.text,fontSize:13,fontWeight:500 }}>{p}</span>
                </div>
                <input type="number" value={grupos[p]||""} onChange={e=>setGrupos(prev=>({...prev,[p]:parseFloat(e.target.value)||0}))}
                  style={{ ...IS2,width:130,textAlign:"right",color:PM[p].color,fontWeight:700 }}/>
              </div>
            ))}
            {err&&<div style={{ color:C.red,fontSize:12,marginTop:8 }}>{err}</div>}
          </>}
        </div>

        {/* Botones de navegación */}
        <div style={{ display:"flex",justifyContent:"space-between",marginTop:16,gap:10 }}>
          <button onClick={()=>paso===0?onDone():setPaso(p=>p-1)}
            style={{ background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.textMuted,padding:"11px 20px",fontSize:13,cursor:"pointer",fontFamily:F }}>
            {paso===0?"Omitir todo":"← Anterior"}
          </button>
          <button onClick={paso===3?finalizar:()=>setPaso(p=>p+1)} disabled={nextDisabled||busy}
            style={{ background:nextDisabled?C.border:C.accent,border:"none",borderRadius:10,color:C.bg,padding:"11px 28px",fontSize:13,fontWeight:600,cursor:nextDisabled?"default":"pointer",fontFamily:F }}>
            {paso===3?(busy?"Guardando…":"¡Empezar!"):"Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [modo,setModo]=useState("login"); // "login" | "setup"
  const [email,setEmail]=useState("");
  const [pwd,setPwd]=useState("");
  const [pwd2,setPwd2]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);

  const submit=async()=>{
    setErr(""); setBusy(true);
    try {
      const fn = modo==="setup" ? API.setup : API.login;
      if(modo==="setup"&&pwd!==pwd2){ setErr("Las contraseñas no coinciden"); setBusy(false); return; }
      const res = await fn(email, pwd);
      localStorage.setItem("claria_token", res.token);
      window.location.reload();
    } catch(e) {
      setErr(modo==="setup"
        ? (e.message.includes("409")?"La cuenta ya tiene contraseña — usa Iniciar sesión":e.message)
        : "Correo o contraseña incorrectos");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:C.bg, fontFamily:F }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ width:380, background:C.card, border:`1px solid ${C.border}`, borderRadius:24, padding:"40px 36px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:32 }}>
          <div style={{ width:44, height:44, borderRadius:14, background:`linear-gradient(135deg,${C.accent},#00A882)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>◈</div>
          <div>
            <div style={{ color:C.text, fontWeight:700, fontSize:22 }}>ClarIA</div>
            <div style={{ color:C.textMuted, fontSize:11, textTransform:"uppercase", letterSpacing:"0.12em" }}>Finanzas IA</div>
          </div>
        </div>
        <div style={{ color:C.textMuted, fontSize:11, marginBottom:6 }}>Correo</div>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="correo@ejemplo.com"
          style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 12px", color:C.text, fontSize:13, outline:"none", width:"100%", marginBottom:14 }}/>
        <div style={{ color:C.textMuted, fontSize:11, marginBottom:6 }}>Contraseña</div>
        <input value={pwd} onChange={e=>setPwd(e.target.value)} type="password" placeholder="••••••••"
          onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 12px", color:C.text, fontSize:13, outline:"none", width:"100%", marginBottom: modo==="setup"?14:24 }}/>
        {modo==="setup"&&<>
          <div style={{ color:C.textMuted, fontSize:11, marginBottom:6 }}>Confirmar contraseña</div>
          <input value={pwd2} onChange={e=>setPwd2(e.target.value)} type="password" placeholder="••••••••"
            onKeyDown={e=>e.key==="Enter"&&submit()}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 12px", color:C.text, fontSize:13, outline:"none", width:"100%", marginBottom:24 }}/>
        </>}
        {err&&<div style={{ color:C.red, fontSize:12, marginBottom:14, textAlign:"center" }}>{err}</div>}
        <button onClick={submit} disabled={busy}
          style={{ width:"100%", background:C.accent, border:"none", borderRadius:8, color:C.bg, padding:"11px", fontSize:14, fontWeight:600, cursor:busy?"default":"pointer", fontFamily:F, marginBottom:16 }}>
          {busy?"…":modo==="setup"?"Crear cuenta":"Entrar"}
        </button>
        <div style={{ textAlign:"center" }}>
          <button onClick={()=>{setModo(m=>m==="login"?"setup":"login");setErr("");}}
            style={{ background:"none", border:"none", color:C.textMuted, fontSize:12, cursor:"pointer", fontFamily:F, textDecoration:"underline" }}>
            {modo==="login"?"Primera vez — configurar cuenta":"Ya tengo cuenta — iniciar sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SECCIÓN PRESUPUESTO VS GASTO REAL ────────────────────────────────────────
const GRUPOS = {
  Esencial:     { color:"#E24B4A", cats:["Salud","Supermercado"] },
  Importante:   { color:"#BA7517", cats:["Comida"] },
  Flexible:     { color:"#378ADD", cats:["Transporte","Compras","Otros"] },
  Prescindible: { color:"#888780", cats:["Suscripciones"] },
};

function SeccionPresupuesto({ porCategoria, presupuesto }) {
  const gastoReal = {};
  (porCategoria||[]).forEach(c=>{ gastoReal[c.categoria]=Number(c.total); });
  const presupMap = {};
  (presupuesto||[]).forEach(p=>{ presupMap[p.categoria]=Number(p.monto); });
  return (
    <div style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
      <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".05em", marginBottom:14 }}>presupuesto vs gasto real</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:16 }}>
        {Object.entries(GRUPOS).map(([nombre,{color,cats}])=>{
          const totalGrupo  = cats.reduce((s,c)=>s+(gastoReal[c]||0),0);
          const totalPresup = cats.reduce((s,c)=>s+(presupMap[c]||0),0);
          const pctGrupo    = totalPresup>0?Math.min((totalGrupo/totalPresup)*100,100):0;
          const excede      = totalGrupo>totalPresup&&totalPresup>0;
          return (
            <div key={nombre} style={{ background:`${excede?"#E24B4A":color}12`, border:`1px solid ${excede?"#E24B4A":color}40`, borderRadius:10, padding:"10px 12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:6 }}>
                <div style={{ fontSize:15, fontWeight:600, color }}>{nombre}</div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:20, fontWeight:600, color, lineHeight:1 }}>
                    ${totalGrupo.toLocaleString("es-MX",{maximumFractionDigits:0})}
                  </div>
                  {totalPresup>0&&<div style={{ fontSize:11, color:C.muted }}>de ${totalPresup.toLocaleString("es-MX",{maximumFractionDigits:0})}</div>}
                </div>
              </div>
              <div style={{ height:5, background:C.bg2, borderRadius:3, overflow:"hidden", marginBottom:8 }}>
                <div style={{ height:"100%", width:`${pctGrupo}%`, background:excede?"#E24B4A":color, borderRadius:3 }}/>
              </div>
              {[...cats].sort((a,b)=>(gastoReal[b]||0)-(gastoReal[a]||0)).map(cat=>{
                const g=gastoReal[cat]||0; const p=presupMap[cat]||0;
                const pct=p>0?Math.min((g/p)*100,100):0; const over=g>p&&p>0;
                return (
                  <div key={cat} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                    <div style={{ fontSize:11, color:C.muted, width:90, flexShrink:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{cat}</div>
                    <div style={{ flex:1, height:3, background:C.bg2, borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:over?"#E24B4A":color, opacity:0.7, borderRadius:2 }}/>
                    </div>
                    <div style={{ fontSize:11, width:52, textAlign:"right", flexShrink:0, color:g>0?(over?"#E24B4A":color):C.muted }}>
                      ${g.toLocaleString("es-MX",{maximumFractionDigits:0})}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SECCIÓN AHORRO + MSI ──────────────────────────────────────────────────────
const META_DEPTO     = 150000;
const AHORRO_MENSUAL = 10000;

function SeccionAhorroMSI({ dash }) {
  const acumulado      = dash?.acumulado ?? 0;
  const libre          = Number(dash?.libre||0);
  const ahorroMensual  = dash?.ahorroMensual || AHORRO_MENSUAL;
  const saldoMSI       = dash?.msiActivos?.filter(m=>Number(m.pagos_restantes)>0)
                              .reduce((s,m)=>s+Number(m.saldo_pendiente),0)||0;
  const mesesRestantes = ahorroMensual>0&&acumulado<META_DEPTO?Math.ceil((META_DEPTO-acumulado)/ahorroMensual):0;
  const pctMeta        = Math.round(Math.min(acumulado/META_DEPTO*100,100));
  const posicionNeta   = acumulado-saldoMSI;
  const COLORS_MSI     = ["#185FA5","#D85A30","#1D9E75","#7F77DD","#BA7517"];
  const planesActivos  = (dash?.msiActivos||[]).filter(m=>Number(m.pagos_restantes)>0);
  const cuotasMSI      = dash?.cuotasMSI||0;
  const totLimCard     = dash?.totLim||0;
  const totUsedCard    = dash?.totUsed||0;
  const utilPct        = totLimCard>0?Math.round(totUsedCard/totLimCard*100):0;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

      {/* ── AHORRO ── */}
      <div style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
        <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".05em", marginBottom:14 }}>resumen de ahorros</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:44, fontWeight:600, color:"#1D9E75", lineHeight:1, letterSpacing:-1 }}>
              ${acumulado.toLocaleString("es-MX")}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>acumulado para departamento</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:C.muted }}>progreso meta</div>
            <div style={{ fontSize:22, fontWeight:600, color:"#1D9E75" }}>{pctMeta}%</div>
            <div style={{ fontSize:11, color:C.muted }}>de ${META_DEPTO.toLocaleString("es-MX")}</div>
          </div>
        </div>
        <div style={{ height:8, background:C.bg2, borderRadius:4, overflow:"hidden", marginBottom:4 }}>
          <div style={{ height:"100%", width:`${pctMeta}%`, background:"linear-gradient(90deg,#185FA5,#1D9E75)", borderRadius:4 }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:12 }}>
          <span>${acumulado.toLocaleString("es-MX")} acumulados</span>
          <span>faltan ${(META_DEPTO-acumulado).toLocaleString("es-MX")}</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:C.border, borderRadius:8, overflow:"hidden", marginBottom:14 }}>
          {[
            { label:"ahorro mensual",  val:`$${ahorroMensual.toLocaleString("es-MX")}`, color:"#1D9E75" },
            { label:"meses restantes", val:mesesRestantes>0?`${mesesRestantes} meses`:"Meta cubierta", color:C.text },
          ].map(k=>(
            <div key={k.label} style={{ background:C.bg2, padding:"8px 12px" }}>
              <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:".04em", marginBottom:2 }}>{k.label}</div>
              <div style={{ fontSize:15, fontWeight:600, color:k.color }}>{k.val}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".04em", marginBottom:8 }}>movimientos de ahorro</div>
        {[
          { name:"Ahorro Departamento",     tipo:"Fijo comprometido · transferencia mensual",       monto:`+$${ahorroMensual.toLocaleString("es-MX")}`,                               color:"#1D9E75" },
          { name:"Excedente libre",          tipo:"Del ingreso tras fijos + MSI + gastos",            monto:`+$${libre.toLocaleString("es-MX",{maximumFractionDigits:0})}`,             color:"#1D9E75" },
          { name:"Posible ahorro adicional", tipo:"Si destinas el 50% del excedente",                monto:`+$${Math.round(libre*0.5).toLocaleString("es-MX")}`,                        color:"#378ADD" },
          { name:"Deuda MSI activa",         tipo:`Compromiso futuro en ${planesActivos.length} planes`, monto:`−$${saldoMSI.toLocaleString("es-MX")}`,                               color:"#E24B4A" },
        ].map(m=>(
          <div key={m.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`0.5px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize:12, fontWeight:500, color:C.text }}>{m.name}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{m.tipo}</div>
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:m.color, flexShrink:0 }}>{m.monto}</div>
          </div>
        ))}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:10, marginTop:4, borderTop:`0.5px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:12, color:C.muted }}>Posición neta de ahorro</div>
            <div style={{ fontSize:11, color:C.muted }}>${acumulado.toLocaleString("es-MX")} − ${saldoMSI.toLocaleString("es-MX")}</div>
          </div>
          <div style={{ fontSize:18, fontWeight:600, color:posicionNeta>=0?"#1D9E75":"#E24B4A" }}>
            {posicionNeta>=0?"+":"−"}${Math.abs(posicionNeta).toLocaleString("es-MX")}
          </div>
        </div>
      </div>

      {/* ── CRÉDITO / MSI ── */}
      <div style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
        <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".05em", marginBottom:14 }}>distribución de crédito</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:44, fontWeight:600, color:"#D85A30", lineHeight:1, letterSpacing:-1 }}>
              ${saldoMSI.toLocaleString("es-MX")}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>saldo total en MSI</div>
          </div>
          {totLimCard>0&&<div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:C.muted }}>del límite utilizado</div>
            <div style={{ fontSize:22, fontWeight:600, color:"#BA7517" }}>{utilPct}%</div>
            <div style={{ fontSize:11, color:C.muted }}>${totLimCard.toLocaleString("es-MX")} límite total</div>
          </div>}
        </div>
        <div style={{ height:8, background:C.bg2, borderRadius:4, overflow:"hidden", marginBottom:4 }}>
          <div style={{ height:"100%", width:`${totLimCard>0?utilPct:0}%`, background:"linear-gradient(90deg,#1D9E75,#BA7517)", borderRadius:4 }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:12 }}>
          <span>${totUsedCard.toLocaleString("es-MX")} utilizados</span>
          <span style={{ color:"#BA7517", fontWeight:500 }}>{utilPct}% del límite</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:C.border, borderRadius:8, overflow:"hidden", marginBottom:14 }}>
          {[
            { label:"cuota mensual",  val:`$${cuotasMSI.toLocaleString("es-MX")}`, color:"#D85A30" },
            { label:"planes activos", val:`${planesActivos.length} planes`,         color:"#378ADD" },
          ].map(k=>(
            <div key={k.label} style={{ background:C.bg2, padding:"8px 12px" }}>
              <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:".04em", marginBottom:2 }}>{k.label}</div>
              <div style={{ fontSize:15, fontWeight:600, color:k.color }}>{k.val}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".04em", marginBottom:8 }}>planes activos</div>
        {planesActivos.length===0
          ? <div style={{ fontSize:12, color:C.muted }}>Sin planes MSI activos</div>
          : planesActivos.map((m,idx)=>{
              const color=COLORS_MSI[idx%COLORS_MSI.length];
              const pagados=Number(m.pagos_hechos), total=Number(m.total_pagos), restantes=Number(m.pagos_restantes);
              return (
                <div key={m.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"8px 0", borderBottom:`0.5px solid ${C.border}` }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:4, color:C.text }}>{m.descripcion}</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:3 }}>
                      {Array.from({length:total}).map((_,i)=>(
                        <div key={i} style={{ width:9, height:9, borderRadius:"50%", background:color, opacity:i<pagados?1:0.2 }}/>
                      ))}
                    </div>
                    <div style={{ fontSize:10, color:C.muted }}>
                      {pagados}/{total} · vence {m.proxima_cuota?new Date(m.proxima_cuota).toLocaleDateString("es-MX",{month:"short",year:"numeric"}):"—"}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", minWidth:80, marginLeft:8 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:"#D85A30", lineHeight:1 }}>
                      ${Number(m.cuota_mensual).toLocaleString("es-MX")}<span style={{ fontSize:10, fontWeight:400, color:C.muted }}>/mes</span>
                    </div>
                    <div style={{ fontSize:11, marginTop:2, color:restantes<=3?"#BA7517":"#E24B4A" }}>
                      ${Number(m.saldo_pendiente).toLocaleString("es-MX")}
                    </div>
                    <div style={{ fontSize:10, color:C.muted }}>saldo restante</div>
                  </div>
                </div>
              );
            })
        }
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:10, marginTop:4, borderTop:`0.5px solid ${C.border}` }}>
          <div style={{ fontSize:11, color:C.muted }}>cuota total · saldo total</div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:15, fontWeight:600, color:"#D85A30" }}>${cuotasMSI.toLocaleString("es-MX")}/mes</div>
            <div style={{ fontSize:11, color:C.muted }}>${saldoMSI.toLocaleString("es-MX")} en {planesActivos.length} planes</div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ── KPI STRIP COMPARTIDA (sin Gastado Variable) ──────────────────────────────
function KpiStrip({ income, fixedItems, msiPlans, txs=[] }) {
  const totalFixed = fixedItems.reduce((s,f)=>s+f.amt,0);
  const totalMSI   = msiPlans.filter(p=>p.paid<p.months).reduce((s,p)=>s+p.mo,0);
  const gastoVar   = txs.filter(t=>t.amt<0&&t.cat!=="Ahorro").reduce((s,t)=>s+Math.abs(t.amt),0);
  const libre      = Math.max(0, income-totalFixed-totalMSI-gastoVar);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:16 }}>
      {[
        { lbl:"Ingreso mensual",  val:fmt(income),     col:C.accent,  sub:null },
        { lbl:"Gastos fijos",     val:fmt(totalFixed), col:C.red,     sub:income>0?`${Math.round(totalFixed/income*100)}% del ingreso`:null },
        { lbl:"MSI / mes",        val:fmt(totalMSI),   col:C.yellow,  sub:income>0?`${Math.round(totalMSI/income*100)}% del ingreso`:null },
        { lbl:"Gastado variable", val:fmt(gastoVar),   col:C.blue,    sub:income>0?`${Math.round(gastoVar/income*100)}% del ingreso`:null },
        { lbl:"Saldo libre",      val:fmt(libre),      col:libre<=0?C.red:C.accent, sub:null },
      ].map(k=>(
        <div key={k.lbl} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 20px", display:"flex", flexDirection:"column", gap:6 }}>
          <span style={{ color:C.textMuted, fontSize:10, fontFamily:F, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>{k.lbl}</span>
          <span style={{ color:k.col, fontSize:26, fontWeight:700, fontFamily:F, lineHeight:1.1 }}>{k.val}</span>
          {k.sub&&<span style={{ color:C.textMuted, fontSize:11, fontFamily:F }}>{k.sub}</span>}
        </div>
      ))}
    </div>
  );
}

// ── TAB GASTOS FIJOS ──────────────────────────────────────────────────────────
const CATEGORIAS_FIJOS = [
  "Inversión","Gimnasio","Trabajo / Consulta",
  "Entretenimiento","Celular","Transporte",
  "Salud","Servicios","Vivienda","Otro",
];
const CAT_COLORS_FIJOS = {
  "Inversión":"#7F77DD","Gimnasio":"#1D9E75","Trabajo / Consulta":"#378ADD",
  "Entretenimiento":"#BA7517","Celular":"#888780","Transporte":"#D85A30",
  "Salud":"#E24B4A","Servicios":"#639922","Vivienda":"#185FA5","Otro":"#5F5E5A",
};

function TabFijos({ fijosData=[], onSave, onDelete }) {
  const [items,    setItems]    = useState(fijosData);
  const [editId,   setEditId]   = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [nuevo,    setNuevo]    = useState({ detalle:"", categoria:"", monto:"" });
  const [saving,   setSaving]   = useState(false);

  const total = items.reduce((s,i)=>s+Number(i.monto),0);
  const $f    = n=>"$"+Number(n).toLocaleString("es-MX",{minimumFractionDigits:0,maximumFractionDigits:0});

  const grupos = items.reduce((acc,item)=>{
    const cat=item.categoria||item.grupo||"Otro";
    if(!acc[cat])acc[cat]=[];
    acc[cat].push(item); return acc;
  },{});

  const handleAgregar = async()=>{
    if(!nuevo.detalle||!nuevo.categoria||!nuevo.monto)return;
    setSaving(true);
    try{
      const item={...nuevo,monto:Number(nuevo.monto),id:Date.now()};
      if(onSave)await onSave(item);
      setItems(p=>[...p,item]);
      setNuevo({detalle:"",categoria:"",monto:""});
    }finally{setSaving(false);}
  };
  const handleEdit=(item)=>{
    setEditId(item.id);
    setEditData({detalle:item.detalle,categoria:item.categoria||item.grupo,monto:item.monto});
  };
  const handleSaveEdit=async(id)=>{
    setSaving(true);
    try{
      const updated=items.map(i=>i.id===id?{...i,...editData,monto:Number(editData.monto)}:i);
      if(onSave)await onSave({id,...editData,monto:Number(editData.monto)});
      setItems(updated); setEditId(null);
    }finally{setSaving(false);}
  };
  const handleDelete=async(id)=>{
    if(!window.confirm("¿Eliminar este gasto fijo?"))return;
    if(onDelete)await onDelete(id);
    setItems(p=>p.filter(i=>i.id!==id));
  };

  const S={
    card:   {background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:"14px 16px"},
    label:  {fontSize:11,color:C.muted,marginBottom:5},
    input:  {width:"100%",background:C.bg2,border:`0.5px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:C.text,outline:"none"},
    select: {width:"100%",background:C.bg2,border:`0.5px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:C.text,outline:"none"},
    btnAdd: {padding:"8px 16px",background:"#185FA5",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:500,cursor:saving?"not-allowed":"pointer",opacity:saving?0.6:1,height:36,whiteSpace:"nowrap"},
    btnIcon:{width:28,height:28,borderRadius:6,border:`0.5px solid ${C.border}`,background:C.card,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12},
    btnDel: {borderColor:"#E24B4A44",background:"#E24B4A11",color:"#E24B4A"},
    btnSave:{padding:"4px 10px",background:"#185FA5",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:500,cursor:"pointer"},
    btnCanc:{padding:"4px 10px",background:"transparent",border:`0.5px solid ${C.border}`,borderRadius:6,color:C.muted,fontSize:11,cursor:"pointer"},
    tag:    (cat)=>({display:"inline-block",fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:500,background:(CAT_COLORS_FIJOS[cat]||"#888")+"22",color:CAT_COLORS_FIJOS[cat]||"#888"}),
  };

  return (
    <div>
      {/* Formulario agregar */}
      <div style={{...S.card,marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:10}}>+ Agregar gasto fijo</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 180px 140px auto",gap:8,alignItems:"flex-end"}}>
          <div>
            <div style={S.label}>Detalle</div>
            <input style={S.input} placeholder="ej. Netflix, Gym, Renta…" value={nuevo.detalle}
              onChange={e=>setNuevo(p=>({...p,detalle:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&handleAgregar()}/>
          </div>
          <div>
            <div style={S.label}>Categoría</div>
            <select style={S.select} value={nuevo.categoria} onChange={e=>setNuevo(p=>({...p,categoria:e.target.value}))}>
              <option value="">Selecciona…</option>
              {CATEGORIAS_FIJOS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={S.label}>Monto mensual</div>
            <input style={{...S.input,textAlign:"right"}} placeholder="$0" value={nuevo.monto}
              onChange={e=>setNuevo(p=>({...p,monto:e.target.value.replace(/[^0-9.]/g,"")}))}/>
          </div>
          <button style={S.btnAdd} onClick={handleAgregar} disabled={saving}>{saving?"…":"Agregar"}</button>
        </div>
      </div>

      {/* Lista agrupada */}
      <div style={S.card}>
        {/* Resumen al tope */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".05em"}}>gastos fijos declarados</div>
            <button onClick={()=>setEditMode(m=>!m)} style={{padding:"4px 12px",borderRadius:7,fontSize:11,fontFamily:F,border:`1px solid ${editMode?C.accent:C.border}`,background:editMode?C.accentDim:"transparent",color:editMode?C.accent:C.textDim,cursor:"pointer"}}>{editMode?"Listo":"Gestionar"}</button>
          {items.length>0&&<div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:11,color:C.muted}}>{items.length} conceptos</span>
            <span style={{fontSize:16,fontWeight:700,color:"#D4537E"}}>{$f(total)}</span>
          </div>}
        </div>
        {Object.entries(grupos).map(([cat,catItems],gi)=>{
          const color=CAT_COLORS_FIJOS[cat]||"#888";
          const catTotal=catItems.reduce((s,i)=>s+Number(i.monto),0);
          const catPct=total>0?Math.round(catTotal/total*100):0;
          return (
            <div key={cat} style={{marginBottom:gi<Object.keys(grupos).length-1?16:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:3,height:16,borderRadius:2,background:color,flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:600,color}}>{cat}</span>
                  <span style={{fontSize:11,color:C.muted}}>{catItems.length} {catItems.length===1?"concepto":"conceptos"}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:C.muted}}>{catPct}%</span>
                  <span style={{fontSize:14,fontWeight:600,color}}>{$f(catTotal)}</span>
                </div>
              </div>
              {catItems.map(item=>(
                <div key={item.id} style={{display:"grid",gridTemplateColumns:"1fr 100px 80px 60px",gap:8,alignItems:"center",padding:"8px 10px 8px 14px",marginBottom:4,borderRadius:8,background:C.bg2,border:`0.5px solid ${editId===item.id?"#185FA5":C.border}`}}>
                  {editId===item.id?(
                    <>
                      <input style={{...S.input,padding:"5px 8px",fontSize:12}} value={editData.detalle}
                        onChange={e=>setEditData(p=>({...p,detalle:e.target.value}))}/>
                      <select style={{...S.select,padding:"5px 8px",fontSize:12}} value={editData.categoria}
                        onChange={e=>setEditData(p=>({...p,categoria:e.target.value}))}>
                        {CATEGORIAS_FIJOS.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                      <input style={{...S.input,padding:"5px 8px",fontSize:12,textAlign:"right"}} value={editData.monto}
                        onChange={e=>setEditData(p=>({...p,monto:e.target.value.replace(/[^0-9.]/g,"")}))}/>
                      <div style={{display:"flex",gap:4,flexDirection:"column"}}>
                        <button style={S.btnSave} onClick={()=>handleSaveEdit(item.id)}>✓</button>
                        <button style={S.btnCanc} onClick={()=>setEditId(null)}>✕</button>
                      </div>
                    </>
                  ):(
                    <>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:C.text}}>{item.detalle}</div>
                        <div style={{height:2,background:C.card,borderRadius:1,overflow:"hidden",marginTop:4,width:"80%"}}>
                          <div style={{height:"100%",width:`${Math.min(Number(item.monto)/total*100*3,100)}%`,background:color,opacity:0.6,borderRadius:1}}/>
                        </div>
                      </div>
                      <div style={{fontSize:11,color:C.muted,textAlign:"center"}}>{Math.round(Number(item.monto)/total*100)}% del total</div>
                      <div style={{fontSize:14,fontWeight:600,color,textAlign:"right"}}>{$f(item.monto)}</div>
                      <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                        {editMode&&<><button style={S.btnIcon} onClick={()=>handleEdit(item)}>✏️</button>
                        <button style={{...S.btnIcon,...S.btnDel}} onClick={()=>handleDelete(item.id)}>✕</button></>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}
        {items.length===0&&(
          <div style={{textAlign:"center",padding:"24px 0",color:C.muted,fontSize:13}}>
            No hay gastos fijos declarados. Agrega el primero arriba.
          </div>
        )}
      </div>
    </div>
  );
}

// ── TAB PRESUPUESTO ───────────────────────────────────────────────────────────
const PRIORIDADES = [
  { key:"Esencial",     color:"#E24B4A", pct:"50% · regla 50/30/20"      },
  { key:"Importante",   color:"#BA7517", pct:"30% · quiero-necesito"     },
  { key:"Flexible",     color:"#378ADD", pct:"10% · discrecional"        },
  { key:"Prescindible", color:"#888780", pct:"5%  · reducible primero"   },
];
const CATS_DEFAULT = [
  { id:1,  nombre:"Vivienda",         sub:"Ahorro depto comprometido",   prioridad:"Esencial",     monto:10000 },
  { id:2,  nombre:"Deuda MSI",        sub:"Pagos comprometidos tarjeta", prioridad:"Esencial",     monto:10065 },
  { id:3,  nombre:"Salud",            sub:"Médico y farmacia",           prioridad:"Esencial",     monto:600   },
  { id:4,  nombre:"Super",            sub:"Despensa básica",             prioridad:"Esencial",     monto:400   },
  { id:5,  nombre:"Restaurantes",     sub:"Salidas y comida",            prioridad:"Importante",   monto:2000  },
  { id:6,  nombre:"Transporte",       sub:"Uber y gasolina",             prioridad:"Importante",   monto:300   },
  { id:7,  nombre:"Telecom",          sub:"Celular e internet",          prioridad:"Importante",   monto:250   },
  { id:8,  nombre:"Seguros",          sub:"Pólizas activas",             prioridad:"Importante",   monto:250   },
  { id:9,  nombre:"Gym",              sub:"Total Pass + parking",        prioridad:"Importante",   monto:2500  },
  { id:10, nombre:"Compras",          sub:"Artículos varios",            prioridad:"Flexible",     monto:400   },
  { id:11, nombre:"Ropa",             sub:"Moda y deportes",             prioridad:"Flexible",     monto:400   },
  { id:12, nombre:"Entretenimiento",  sub:"Ocio y cultura",              prioridad:"Flexible",     monto:300   },
  { id:13, nombre:"Trabajo/Consulta", sub:"Tools y suscripciones",       prioridad:"Flexible",     monto:700   },
  { id:14, nombre:"Viajes",           sub:"Escapadas y vuelos",          prioridad:"Prescindible", monto:300   },
  { id:15, nombre:"Belleza",          sub:"Estética y cuidado",          prioridad:"Prescindible", monto:300   },
];

function TabPresupuesto({ presupuestoData=[], ingreso=40000, onSave }) {
  const [cats,     setCats]     = useState(presupuestoData.length>0 ? presupuestoData.map((p,i)=>({id:i+1,nombre:p.categoria,sub:"",prioridad:"Flexible",monto:Number(p.monto)})) : CATS_DEFAULT);
  const [editId,   setEditId]   = useState(null);
  const [editMonto,setMonto]    = useState("");
  const [drag,     setDrag]     = useState(null);
  const [nuevo,    setNuevo]    = useState({nombre:"",sub:"",prioridad:"Flexible",monto:""});
  const [saving,   setSaving]   = useState(false);
  const [editMode, setEditMode] = useState(false);

  const $f = n=>"$"+Number(n).toLocaleString("es-MX",{maximumFractionDigits:0});
  const totalAsignado = cats.reduce((s,c)=>s+c.monto,0);
  const sinAsignar    = Math.max(0, ingreso-totalAsignado);
  const pctPor  = p=>ingreso>0?Math.round(cats.filter(c=>c.prioridad===p).reduce((s,c)=>s+c.monto,0)/ingreso*100):0;
  const totalPor= p=>cats.filter(c=>c.prioridad===p).reduce((s,c)=>s+c.monto,0);

  const handleDrop   = p=>{ if(!drag)return; setCats(prev=>prev.map(c=>c.id===drag?{...c,prioridad:p}:c)); setDrag(null); };
  const handleMonto  = (id,val)=>{ const num=Number(val.replace(/[^0-9.]/g,""))||0; setCats(prev=>prev.map(c=>c.id===id?{...c,monto:num}:c)); };
  const handleAgregar= ()=>{ if(!nuevo.nombre||!nuevo.monto)return; setCats(prev=>[...prev,{id:Date.now(),...nuevo,monto:Number(String(nuevo.monto).replace(/[^0-9.]/g,""))}]); setNuevo({nombre:"",sub:"",prioridad:"Flexible",monto:""}); };
  const handleDelete = id=>setCats(prev=>prev.filter(c=>c.id!==id));
  const handleGuardar= async()=>{ setSaving(true); try{if(onSave)await onSave(cats);}finally{setSaving(false);} };

  const segs    = PRIORIDADES.map(p=>({...p, pctBarra:ingreso>0?Math.round(totalPor(p.key)/ingreso*100):0}));
  const pctLibre= ingreso>0?Math.round(sinAsignar/ingreso*100):0;

  const S={
    btn:     {padding:"6px 16px",background:saving?"#0e3a6e":"#185FA5",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:500,cursor:"pointer"},
    bar:     {height:14,borderRadius:7,overflow:"hidden",display:"flex",marginBottom:6,gap:2},
    barSeg:  (color,pct)=>({height:"100%",width:`${pct}%`,background:color,borderRadius:4,transition:"width .3s"}),
    sumCard: {background:C.bg2,borderRadius:10,padding:"10px 14px",border:`0.5px solid ${C.border}`},
    laneWrap:(color)=>({borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}),
    laneHead:(color)=>({padding:"12px 14px 10px",background:color+"18",borderRadius:"12px 12px 0 0"}),
    laneBody:(color)=>({flex:1,padding:"6px 8px 8px",background:color+"08",display:"flex",flexDirection:"column",gap:5,minHeight:100}),
    catCard: (color,first)=>({borderRadius:8,padding:"8px 10px",border:`0.5px solid ${color}${first?"44":"22"}`,background:color+(first?"18":"0e"),position:"relative",cursor:"grab"}),
    input:   (color)=>({width:"100%",background:"transparent",border:"none",fontSize:15,fontWeight:600,outline:"none",padding:0,color,cursor:"text"}),
    addBtn:  (color)=>({marginTop:4,padding:"6px 8px",borderRadius:6,border:`0.5px dashed ${color}44`,fontSize:11,color:color+"88",textAlign:"center",cursor:"pointer"}),
    delBtn:  {position:"absolute",top:5,right:6,fontSize:10,color:C.muted,cursor:"pointer",background:"none",border:"none",opacity:0.7},
    newInput:{width:"100%",background:C.card,border:`0.5px solid ${C.border}`,borderRadius:7,padding:"7px 10px",fontSize:12,color:C.text,outline:"none"},
  };

  return (
    <div style={{color:C.text}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:13,fontWeight:600}}>Diseña tu presupuesto mensual</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>Edita montos directo · arrastra categorías entre prioridades</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={{padding:"6px 14px",borderRadius:8,fontSize:12,border:`1px solid ${editMode?C.red:C.border}`,background:editMode?"#E24B4A18":"transparent",color:editMode?"#E24B4A":C.textDim,cursor:"pointer"}} onClick={()=>setEditMode(m=>!m)}>{editMode?"Listo":"Gestionar"}</button>
          <button style={S.btn} onClick={handleGuardar} disabled={saving}>{saving?"Guardando…":"Guardar cambios"}</button>
        </div>
      </div>

      {/* Formulario agregar */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:"10px 14px",marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>+ Nueva categoría</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 140px 120px 100px auto",gap:8,alignItems:"flex-end"}}>
          {[["Nombre","nombre","ej. Streaming…"],["Descripción","sub","opcional"]].map(([l,k,ph])=>(
            <div key={k}><div style={{fontSize:11,color:C.muted,marginBottom:4}}>{l}</div>
              <input style={S.newInput} placeholder={ph} value={nuevo[k]} onChange={e=>setNuevo(p=>({...p,[k]:e.target.value}))}/></div>
          ))}
          <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>Prioridad</div>
            <select style={{...S.newInput,cursor:"pointer"}} value={nuevo.prioridad} onChange={e=>setNuevo(p=>({...p,prioridad:e.target.value}))}>
              {PRIORIDADES.map(p=><option key={p.key} value={p.key}>{p.key}</option>)}
            </select></div>
          <div><div style={{fontSize:11,color:C.muted,marginBottom:4}}>Monto</div>
            <input style={{...S.newInput,textAlign:"right"}} placeholder="$0" value={nuevo.monto}
              onChange={e=>setNuevo(p=>({...p,monto:e.target.value.replace(/[^0-9.]/g,"")}))}
              onKeyDown={e=>e.key==="Enter"&&handleAgregar()}/></div>
          <button style={{...S.btn,padding:"7px 14px"}} onClick={handleAgregar}>Agregar</button>
        </div>
      </div>

      {/* Barra distribución */}
      <div style={S.bar}>
        {segs.map(s=><div key={s.key} style={S.barSeg(s.color,s.pctBarra)}/>)}
        <div style={S.barSeg(C.bg2||"#1e1e2e",pctLibre)}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:10}}>
        {segs.map(s=><span key={s.key} style={{color:s.color}}>{s.key} {s.pctBarra}%</span>)}
        <span>Sin asignar {pctLibre}%</span>
      </div>

      {/* Resúmenes */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        <div style={S.sumCard}><div style={{fontSize:11,color:C.muted,marginBottom:3}}>presupuesto asignado</div><div style={{fontSize:16,fontWeight:600,color:"#1D9E75"}}>{$f(totalAsignado)}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{Math.round(totalAsignado/ingreso*100)}% del ingreso</div></div>
        <div style={S.sumCard}><div style={{fontSize:11,color:C.muted,marginBottom:3}}>sin asignar (colchón)</div><div style={{fontSize:16,fontWeight:600,color:"#378ADD"}}>{$f(sinAsignar)}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{pctLibre}% disponible</div></div>
        <div style={S.sumCard}><div style={{fontSize:11,color:C.muted,marginBottom:3}}>regla 50/30/20</div><div style={{fontSize:16,fontWeight:600,color:"#BA7517"}}>{pctPor("Esencial")}/{pctPor("Importante")}/{pctPor("Flexible")}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{pctPor("Esencial")>50?"Esencial > 50%":"Distribución OK ✅"}</div></div>
      </div>

      {/* Kanban */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {PRIORIDADES.map(p=>{
          const color=p.color, catsPrio=cats.filter(c=>c.prioridad===p.key), total=catsPrio.reduce((s,c)=>s+c.monto,0);
          return (
            <div key={p.key} style={S.laneWrap(color)} onDragOver={e=>e.preventDefault()} onDrop={()=>handleDrop(p.key)}>
              <div style={S.laneHead(color)}>
                <div style={{fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",color}}>{p.key}</div>
                <div style={{fontSize:24,fontWeight:600,lineHeight:1,color,marginTop:2}}>{$f(total)}</div>
                <div style={{fontSize:11,color,opacity:.7,marginTop:2}}>{pctPor(p.key)}% del ingreso</div>
              </div>
              <div style={S.laneBody(color)}>
                {catsPrio.map((cat,ci)=>(
                  <div key={cat.id} draggable onDragStart={()=>setDrag(cat.id)} style={S.catCard(color,ci===0)}>
                    {editMode&&<button style={S.delBtn} onClick={()=>handleDelete(cat.id)}>✕</button>}
                    <div style={{fontSize:12,fontWeight:500,marginBottom:2,paddingRight:editMode?16:0}}>{cat.nombre}</div>
                    <input style={S.input(color)} value={editId===cat.id?editMonto:$f(cat.monto)}
                      onFocus={()=>{setEditId(cat.id);setMonto(String(cat.monto));}}
                      onBlur={()=>{handleMonto(cat.id,editMonto);setEditId(null);}}
                      onChange={e=>setMonto(e.target.value)}/>
                    {cat.sub&&<div style={{fontSize:10,opacity:.6,marginTop:2}}>{cat.sub}</div>}
                  </div>
                ))}
                <div style={S.addBtn(color)} onClick={()=>setNuevo(prev=>({...prev,prioridad:p.key}))}>+ agregar aquí</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TABS=[
  { id:"estado",       label:"Estado",        icon:"📊" },
  { id:"fixed",        label:"Gastos Fijos",  icon:"📌" },
  { id:"budget",       label:"Presupuestos",  icon:"🎯" },
  { id:"cards",        label:"Tarjetas",      icon:"💳" },
  { id:"transactions", label:"Transacciones", icon:"↕️"  },
];

export default function App() {
  const [token,setToken]=useState(()=>localStorage.getItem("claria_token"));

  if(!token) return <LoginScreen/>;

  const logout=()=>{ localStorage.removeItem("claria_token"); setToken(null); };

  return <Dashboard logout={logout}/>;
}

function Dashboard({ logout }) {
  const [tab,setTab]=useState("estado");
  const [txs,setTxs]=useState(INIT_TX);
  const [cards,setCards]=useState([]);
  const [sidebarOpen,setSidebar]=useState(true);
  const [groupBudgets,setGroupBudgets]=useState(GROUP_BUDGET_DEFAULTS);
  const [fixedItems,setFixedItems]=useState(FIXED_DEFAULT);
  const [income,setIncome]=useState(21500);
  const [msiPlans,setMsiPlans]=useState(MSI_DEFAULT);
  const [prevSavings,setPrevSavings]=useState(PREV_SAVINGS_DEFAULT);
  const [loading,setLoading]=useState(true);
  const [apiError,setApiError]=useState(null);
  const [onboarding,setOnboarding]=useState(false);

  const cargarDatos=()=>{
    const periodo=periodoActual();
    setLoading(true);
    Promise.all([
      API.getDashboard(periodo),
      API.getFijos(),
      API.getMSI(),
      API.getPresupuestoGrupos(),
      API.getTarjetas(),
    ]).then(([dash,fijosData,msiData,grupos,tarjetasData])=>{
      if(dash.ingreso) setIncome(Number(dash.ingreso));
      const txsApi=dash.ultimasTransacciones||[];
      if(txsApi.length) setTxs(txsApi.map(mapApiTx));
      if(!dash.ingreso||dash.ingreso===0) setOnboarding(true);
      if(fijosData.fijos?.length) setFixedItems(fijosData.fijos.map(mapApiFijo));
      if(msiData.msi?.length)     setMsiPlans(msiData.msi.map(mapApiMsi));
      if(grupos && Object.values(grupos).some(v=>v>0)) setGroupBudgets(grupos);
      if(tarjetasData?.length) setCards(tarjetasData.map(mapApiCard));
    }).catch(err=>{
      console.error("ClarIA API:", err);
      setApiError(err.message);
    }).finally(()=>setLoading(false));
  };

  useEffect(()=>{ cargarDatos(); },[]);

  const addTx=(tx)=>{
    setTxs(p=>[tx,...p]);
    API.postGasto({
      descripcion:     tx.desc,
      monto_mxn:       Math.abs(tx.amt),
      categoria:       DASH_TO_API_CAT[tx.cat] ?? "Otro",
      periodo:         periodoActual(),
      via:             tx.src ?? "manual",
      fecha_operacion: tx.date,
    }).catch(err=>console.error("Error guardando en API:",err));
  };

  const saveGroupBudgets = (updater) => {
    setGroupBudgets(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      Object.entries(next).forEach(([p, m]) => {
        if(prev[p] !== m) API.putPresupuestoGrupo(p, m).catch(console.error);
      });
      return next;
    });
  };

  if(onboarding) return <OnboardingWizard defaultGroupBudgets={groupBudgets} onDone={()=>{ setOnboarding(false); cargarDatos(); }}/>;

  const alerts=computeAlerts(txs,fixedItems,income,msiPlans);
  return (
    <div style={{ display:"flex", height:"100vh", background:C.bg, fontFamily:F, overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}body{background:${C.bg}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
        select option{background:${C.card};color:${C.text}}input[type=date]{color-scheme:dark}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes slideUp{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:none}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      {loading&&<div style={{ position:"fixed", inset:0, background:C.bg, zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
        <div style={{ width:44, height:44, borderRadius:"50%", border:`3px solid ${C.border}`, borderTopColor:C.accent, animation:"spin 0.8s linear infinite" }}/>
        <div style={{ color:C.textDim, fontFamily:F, fontSize:14 }}>Conectando con ClarIA…</div>
      </div>}
      {apiError&&<div style={{ position:"fixed", bottom:80, right:28, background:C.card, border:`1px solid ${C.red}`, borderRadius:12, padding:"12px 18px", zIndex:300, maxWidth:340, fontFamily:F }}>
        <div style={{ color:C.red, fontSize:13, fontWeight:600, marginBottom:4 }}>Error de conexión</div>
        <div style={{ color:C.textDim, fontSize:12 }}>{apiError}</div>
        <button onClick={()=>setApiError(null)} style={{ ...BtnS, marginTop:8, padding:"4px 10px", fontSize:11 }}>Cerrar</button>
      </div>}
      {sidebarOpen&&<aside style={{ width:216, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"24px 22px 16px", borderBottom:`1px solid ${C.border}`, marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:11 }}>
            <div style={{ width:38, height:38, borderRadius:12, background:`linear-gradient(135deg,${C.accent},#00A882)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, boxShadow:`0 0 20px ${C.accentGlow}` }}>◈</div>
            <div>
              <div style={{ color:C.text, fontWeight:700, fontSize:19, letterSpacing:"-0.02em", lineHeight:1 }}>ClarIA</div>
              <div style={{ color:C.textMuted, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", marginTop:2 }}>Finanzas IA</div>
            </div>
          </div>
        </div>
        <nav style={{ flex:1, padding:"8px 10px" }}>
          {TABS.map(t=>{ const active=tab===t.id; return <button key={t.id} onClick={()=>setTab(t.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:11, padding:"10px 14px", borderRadius:12, marginBottom:3, background:active?C.accentDim:"transparent", border:active?`1px solid ${C.accentGlow}`:"1px solid transparent", color:active?C.accent:C.textDim, fontFamily:F, fontSize:13, fontWeight:active?600:400, cursor:"pointer", transition:"all 0.15s", textAlign:"left" }}>
            <span style={{ fontSize:15 }}>{t.icon}</span>{t.label}
          </button>; })}
        </nav>
      </aside>}
      <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <header style={{ padding:"16px 28px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:14, background:C.surface, flexShrink:0 }}>
          <button onClick={()=>setSidebar(o=>!o)} style={{ width:36, height:36, borderRadius:10, background:"transparent", border:`1px solid ${C.border}`, cursor:"pointer", color:C.textDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textDim;}}>☰</button>
          <div style={{ flex:1 }}>
            <h1 style={{ color:C.text, fontSize:18, fontWeight:700, letterSpacing:"-0.025em", fontFamily:F }}>{TABS.find(t=>t.id===tab)?.label}</h1>
            <p style={{ color:C.textMuted, fontSize:12, marginTop:2, fontFamily:F }}>Mayo 2026 · {txs.length} movimientos</p>
          </div>
          <button onClick={logout} title="Cerrar sesión"
            style={{ width:36, height:36, borderRadius:10, background:"transparent", border:`1px solid ${C.border}`, cursor:"pointer", color:C.textDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.color=C.red;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textDim;}}>⏻</button>
        </header>
        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 80px", display:"flex", flexDirection:"column", gap:0 }}>
          {tab==="estado"       &&<Estado        txs={txs} groupBudgets={groupBudgets} fixedItems={fixedItems} income={income} msiPlans={msiPlans} prevSavings={prevSavings} cards={cards}/>}
          {tab==="fixed"        &&<><KpiStrip income={income} fixedItems={fixedItems} msiPlans={msiPlans} txs={txs}/>
            <TabFijos
              fijosData={fixedItems.map(f=>({id:f.id,detalle:f.name,categoria:f.cat,grupo:f.cat,monto:f.amt,icono:f.icon,dia_cobro:f.day}))}
              onSave={async(item)=>{
                const payload={detalle:item.detalle,monto:Number(item.monto),grupo:item.categoria||item.grupo||"Otro",icono:item.icono||"💡",dia_cobro:item.dia_cobro||1};
                const existing=fixedItems.find(f=>f.id===item.id);
                if(existing){const u=await API.putFijo(item.id,payload).catch(console.error);if(u)setFixedItems(p=>p.map(f=>f.id===item.id?mapApiFijo(u,0):f));}
                else{const c=await API.postFijo(payload).catch(console.error);if(c)setFixedItems(p=>[...p,mapApiFijo(c,p.length)]);}
              }}
              onDelete={async(id)=>{await API.deleteFijo(id).catch(console.error);setFixedItems(p=>p.filter(f=>f.id!==id));}}
            /></>}
          {tab==="cards"        &&<CreditCards   txs={txs} cards={cards} setCards={setCards} setTxs={setTxs} msiPlans={msiPlans} onImportDone={cargarDatos}/>}
          {tab==="budget"       &&<><KpiStrip income={income} fixedItems={fixedItems} msiPlans={msiPlans} txs={txs}/>
            <TabPresupuesto
              presupuestoData={[]}
              ingreso={income}
              onSave={async(cats)=>{
                const grupos={};
                cats.forEach(cat=>{grupos[cat.prioridad]=(grupos[cat.prioridad]||0)+cat.monto;});
                saveGroupBudgets(grupos);
              }}
            /></>}
          {tab==="transactions" &&<Transactions  txs={txs} setTxs={setTxs} onAdd={addTx} cards={cards}/>}
        </div>
      </main>
    </div>
  );
}
