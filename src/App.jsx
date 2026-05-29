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
};
const F = "'IBM Plex Sans', system-ui, sans-serif";
const fmt = n => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0}).format(Math.abs(n));
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
  "Vivienda":"Esencial","Salud":"Esencial","Servicios":"Esencial",
  "Tecnología":"Importante","Entretenimiento":"Prescindible","Otros":"Flexible",
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
  cardId: null,
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
  cardId: null,
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
const MSI_DEFAULT = [
  { id:1, name:"MacBook Air M3", store:"Apple Store", total:28999, months:18, paid:8,  start:"2025-09-01", mo:1611, cardId:2 },
  { id:2, name:'TV OLED LG 55"', store:"Liverpool",   total:18500, months:12, paid:5,  start:"2026-01-01", mo:1542, cardId:1 },
  { id:3, name:"iPhone 16 Pro",  store:"iShop",       total:22999, months:24, paid:3,  start:"2026-03-01", mo:958,  cardId:2 },
  { id:4, name:"Platzi Expert+", store:"Platzi",      total:3200,  months:3,  paid:2,  start:"2026-04-01", mo:1067, cardId:3 },
];
const CARDS = [
  { id:1, name:"Azul BBVA",       bank:"BBVA",        clr:["#002C7A","#0058C8"], last4:"4521", lim:35000, used:12840, cut:12, pay:7  },
  { id:2, name:"Oro Citibanamex", bank:"Citibanamex", clr:["#880000","#CC1E00"], last4:"7893", lim:50000, used:28500, cut:22, pay:17 },
  { id:3, name:"Green AMEX",      bank:"AMEX",        clr:["#003F6B","#006EA8"], last4:"1029", lim:80000, used:5200,  cut:5,  pay:28 },
];
let _txId = 200;
const PREV_SAVINGS_DEFAULT = 16500;
const INIT_TX = [
  { id:1,  date:"2026-05-28", desc:"Rappi – Sushi Itto",    amt:-420,  cat:"Comida",        icon:"🍣", src:"whatsapp", cardId:1    },
  { id:2,  date:"2026-05-27", desc:"OXXO Bebidas",          amt:-87,   cat:"Comida",        icon:"🥤", src:"whatsapp", cardId:2    },
  { id:3,  date:"2026-05-27", desc:"Salario Quincenal",     amt:18500, cat:"Ingreso",       icon:"💰", src:"manual",   cardId:null },
  { id:4,  date:"2026-05-26", desc:"Netflix",               amt:-219,  cat:"Suscripciones", icon:"📺", src:"manual",   cardId:1    },
  { id:5,  date:"2026-05-25", desc:"Uber – Trabajo",        amt:-134,  cat:"Transporte",    icon:"🚗", src:"whatsapp", cardId:2    },
  { id:6,  date:"2026-05-24", desc:"Walmart Despensa",      amt:-1240, cat:"Supermercado",  icon:"🛒", src:"whatsapp", cardId:1    },
  { id:7,  date:"2026-05-23", desc:"Smart Fit",             amt:-499,  cat:"Salud",         icon:"🏋️", src:"manual",   cardId:3    },
  { id:8,  date:"2026-05-22", desc:"Amazon – Audífonos",    amt:-1890, cat:"Compras",       icon:"🎧", src:"whatsapp", cardId:2    },
  { id:9,  date:"2026-05-21", desc:"Transferencia BBVA",    amt:3000,  cat:"Ingreso",       icon:"💳", src:"manual",   cardId:null },
  { id:10, date:"2026-05-18", desc:"Gasolina PEMEX",        amt:-650,  cat:"Transporte",    icon:"⛽", src:"whatsapp", cardId:1    },
  { id:11, date:"2026-05-17", desc:"Farmacia Guadalajara",  amt:-340,  cat:"Salud",         icon:"💊", src:"whatsapp", cardId:3    },
  { id:12, date:"2026-05-15", desc:"Spotify Family",        amt:-119,  cat:"Suscripciones", icon:"🎵", src:"manual",   cardId:1    },
  { id:13, date:"2026-05-10", desc:"CETES – Ahorro mensual",amt:-2000, cat:"Ahorro",        icon:"📈", src:"manual",   cardId:null },
  { id:14, date:"2026-05-03", desc:"GBM – Inversión",       amt:-1500, cat:"Ahorro",        icon:"📊", src:"manual",   cardId:null },
];
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
const ScoreGauge = ({ score }) => {
  const r=58,cx=78,cy=78,s0=-220,s1=40,toRad=d=>(d*Math.PI)/180;
  const arc=(a1,a2)=>{const x1=cx+r*Math.cos(toRad(a1)),y1=cy+r*Math.sin(toRad(a1)),x2=cx+r*Math.cos(toRad(a2)),y2=cy+r*Math.sin(toRad(a2));return`M ${x1} ${y1} A ${r} ${r} 0 ${a2-a1>180?1:0} 1 ${x2} ${y2}`;};
  const vd=s0+(score/100)*(s1-s0), col=score>=70?C.accent:score>=40?C.yellow:C.red;
  return <svg viewBox="0 0 156 116" style={{ width:140, height:105 }}>
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

function TxModal({ tx, onSave, onClose }) {
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
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Tarjeta</div><select value={d.cardId||""} onChange={e=>setD(p=>({...p,cardId:e.target.value?parseInt(e.target.value):null}))} style={IS}><option value="">Sin tarjeta</option>{CARDS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
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
  const FIXED_CATS=["Vivienda","Entretenimiento","Salud","Tecnología","Servicios","Otros"];
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
          <div><div style={{ color:C.textMuted, fontSize:11, fontFamily:F, marginBottom:4 }}>Categoría</div><select value={d.cat||"Servicios"} onChange={e=>setD(p=>({...p,cat:e.target.value}))} style={IS}>{FIXED_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
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
function CardDetailModal({ card, txs, onClose }) {
  const cardTxs=txs.filter(t=>t.cardId===card.id&&t.amt<0);
  const msiPlans=MSI.filter(m=>m.cardId===card.id);
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
          {msiPlans.length>0&&<div style={{ margin:"16px 0" }}>
            <Label>Planes MSI</Label>
            {msiPlans.map(p=>(
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

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────
const TIPOS_EXCLUIR = ["pago","msi_cuota","abono_puntos","abono"];

function Transactions({ txs, setTxs, onAdd }) {
  const [type,setType]=useState("all"); const [catF,setCatF]=useState("all");
  const [cardF,setCardF]=useState("all"); const [from,setFrom]=useState(""); const [to,setTo]=useState("");
  const [editTx,setEditTx]=useState(null); const [addingTx,setAddingTx]=useState(false);
  const [cargando,setCargando]=useState(false);

  useEffect(()=>{
    setCargando(true);
    API.getGastos({ limit:500 })
      .then(rows=>{
        const mapped=rows
          .filter(t=>!TIPOS_EXCLUIR.includes(t.tipo))
          .map(mapApiTx);
        if(mapped.length) setTxs(mapped);
      })
      .catch(err=>console.error("Error cargando transacciones:",err))
      .finally(()=>setCargando(false));
  },[]);

  const cats=["all",...new Set(txs.map(t=>t.cat))];
  const list=txs.filter(t=>{
    if(type==="gastos"&&t.amt>=0)return false; if(type==="abonos"&&t.amt<0)return false;
    if(catF!=="all"&&t.cat!==catF)return false;
    if(cardF==="sin"&&t.cardId!==null)return false;
    if(cardF!=="all"&&cardF!=="sin"&&t.cardId!==parseInt(cardF))return false;
    if(from&&t.date<from)return false; if(to&&t.date>to)return false;
    return true;
  });
  const saveTx=tx=>{ if(tx.id&&txs.find(t=>t.id===tx.id)) setTxs(p=>p.map(t=>t.id===tx.id?tx:t)); else onAdd(tx); };
  const delTx=id=>{ if(confirm("¿Eliminar esta transacción?")) setTxs(p=>p.filter(t=>t.id!==id)); };
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
          {CARDS.map(c=><option key={c.id} value={c.id.toString()}>{c.name}</option>)}
        </select>
        <div style={{ width:1, height:18, background:C.border, margin:"0 4px" }}/>
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={sel}/>
        <span style={{ color:C.textMuted, fontSize:11, fontFamily:F }}>—</span>
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={sel}/>
        <button onClick={()=>setAddingTx(true)} style={{ ...BtnP, marginLeft:"auto", padding:"6px 16px", fontSize:12 }}>+ Añadir</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"44px 34px 1fr 78px 110px 96px 140px 72px 76px", padding:"5px 14px", marginBottom:5, fontFamily:F, fontSize:10, color:C.textMuted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em" }}>
        <div>#ID</div><div/><div>Descripción</div><div>Fecha</div><div>Categoría</div><div style={{ textAlign:"right" }}>Monto</div><div style={{ textAlign:"center" }}>Tarjeta</div><div style={{ textAlign:"center" }}>Origen</div><div/>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {list.map((tx,i)=>{
          const card=CARDS.find(c=>c.id===tx.cardId);
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
                <button onClick={()=>setEditTx(tx)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, cursor:"pointer", padding:"3px 7px", fontSize:11 }}>✏️</button>
                <button onClick={()=>delTx(tx.id)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, cursor:"pointer", padding:"3px 7px", fontSize:11 }}>🗑</button>
              </div>
            </div>
          );
        })}
        {cargando&&<div style={{ color:C.textMuted, fontSize:14, fontFamily:F, textAlign:"center", padding:"40px 0" }}>Cargando transacciones…</div>}
        {!cargando&&list.length===0&&<div style={{ color:C.textMuted, fontSize:14, fontFamily:F, textAlign:"center", padding:"40px 0" }}>Sin transacciones con esos filtros</div>}
      </div>
      {(editTx||addingTx)&&<TxModal tx={editTx||{date:todayStr(),desc:"",amt:"",cat:"Comida",src:"manual",cardId:null}} onSave={saveTx} onClose={()=>{setEditTx(null);setAddingTx(false);}}/>}
    </div>
  );
}

// ── CREDIT CARDS ──────────────────────────────────────────────────────────────
function CreditCards({ txs }) {
  const [selected,setSelected]=useState(null);
  const totUsed=CARDS.reduce((s,c)=>s+c.used,0), totLim=CARDS.reduce((s,c)=>s+c.lim,0);
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:20, marginBottom:24 }}>
        {CARDS.map(c=>(
          <div key={c.id} onClick={()=>setSelected(c)} style={{ borderRadius:20, overflow:"hidden", border:`1px solid ${C.border}`, cursor:"pointer", transition:"transform 0.18s, box-shadow 0.18s" }}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,0.5)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
            <div style={{ background:`linear-gradient(135deg,${c.clr[0]},${c.clr[1]})`, padding:"24px 28px 20px", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", right:-24, top:-24, width:110, height:110, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }}/>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <div><div style={{ color:"rgba(255,255,255,0.55)", fontSize:10, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.12em" }}>{c.bank}</div><div style={{ color:"#fff", fontSize:17, fontWeight:700, fontFamily:F, marginTop:4 }}>{c.name}</div></div>
                <div style={{ color:"rgba(255,255,255,0.8)", fontSize:26 }}>💳</div>
              </div>
              <div style={{ color:"rgba(255,255,255,0.45)", fontSize:14, fontFamily:F, marginTop:18, letterSpacing:"0.18em" }}>•••• •••• •••• {c.last4}</div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:18 }}>
                <div><div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, fontFamily:F, textTransform:"uppercase" }}>Saldo usado</div><div style={{ color:"#fff", fontSize:20, fontWeight:700, fontFamily:F }}>{fmt(c.used)}</div></div>
                <div style={{ textAlign:"right" }}><div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, fontFamily:F, textTransform:"uppercase" }}>Límite</div><div style={{ color:"rgba(255,255,255,0.75)", fontSize:16, fontFamily:F }}>{fmt(c.lim)}</div></div>
              </div>
            </div>
            <div style={{ background:C.card, padding:"16px 28px 18px" }}>
              <ProgressBar value={c.used} max={c.lim} h={7}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                <span style={{ color:C.textMuted, fontSize:11, fontFamily:F }}>{((c.used/c.lim)*100).toFixed(0)}% utilizado</span>
                <span style={{ color:C.textDim, fontSize:11, fontFamily:F }}>{fmt(c.lim-c.used)} disponible</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:14 }}>
                {[{lbl:"Corte",val:`Día ${c.cut}`,sub:`en ${daysTo(c.cut)} días`,col:C.yellow},{lbl:"Pago límite",val:`Día ${c.pay}`,sub:`en ${daysTo(c.pay)} días`,col:daysTo(c.pay)<=5?C.red:C.accent}].map(item=>(
                  <div key={item.lbl} style={{ background:C.surface, borderRadius:10, padding:"10px 14px" }}>
                    <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase", marginBottom:4 }}>{item.lbl}</div>
                    <div style={{ color:C.text, fontSize:13, fontFamily:F, fontWeight:600 }}>{item.val}</div>
                    <div style={{ color:item.col, fontSize:11, fontFamily:F, marginTop:2 }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <SCard>
        <Label>Resumen global de crédito</Label>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20, marginBottom:16 }}>
          {[{lbl:"Total usado",val:fmt(totUsed),col:C.red},{lbl:"Límite total",val:fmt(totLim),col:C.text},{lbl:"Utilización global",val:`${((totUsed/totLim)*100).toFixed(0)}%`,col:(totUsed/totLim)>0.3?C.yellow:C.accent}].map(m=>(
            <div key={m.lbl}><div style={{ color:C.textDim, fontSize:12, fontFamily:F, marginBottom:6 }}>{m.lbl}</div><div style={{ color:m.col, fontSize:22, fontWeight:700, fontFamily:F }}>{m.val}</div></div>
          ))}
        </div>
        <ProgressBar value={totUsed} max={totLim} h={8}/>
      </SCard>
      {selected&&<CardDetailModal card={selected} txs={txs} onClose={()=>setSelected(null)}/>}
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
  const catCol={ Vivienda:C.blue, Entretenimiento:C.purple, Salud:C.accent, Tecnología:C.teal, Servicios:C.yellow, Otros:C.textDim };

  const saveItem=item=>{ if(item.id&&items.find(i=>i.id===item.id)) setItems(p=>p.map(i=>i.id===item.id?item:i)); else setItems(p=>[...p,item]); };
  const delItem=id=>{ if(confirm("¿Eliminar este gasto fijo?")) setItems(p=>p.filter(i=>i.id!==id)); };

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
              {d.items.map(item=>(
                <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 18px", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, fontFamily:F }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}><span style={{ fontSize:18 }}>{item.icon}</span><span style={{ color:C.text, fontSize:14 }}>{item.name}</span></div>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <span style={{ color:C.textDim, fontSize:12 }}>Día {item.day}</span>
                    <span style={{ color:C.text, fontWeight:600, fontSize:14 }}>{fmt(item.amt)}</span>
                    <button onClick={()=>setEditItem(item)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, cursor:"pointer", padding:"3px 8px", fontSize:12 }}>✏️</button>
                    <button onClick={()=>delItem(item.id)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, cursor:"pointer", padding:"3px 8px", fontSize:12 }}>🗑</button>
                  </div>
                </div>
              ))}
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
function MSIPlans({ plans }) {
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
        const card=CARDS.find(c=>c.id===plan.cardId);
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

// ── ESTADO — priority cards first, score with factor breakdown ────────────────
function Estado({ txs, groupBudgets, fixedItems, income, msiPlans, prevSavings }) {
  const INCOME=income;
  const totalFixed=fixedItems.reduce((s,f)=>s+f.amt,0);
  const totalMSI=msiPlans.reduce((s,p)=>s+p.mo,0);
  const totalVar=3600;
  const free=Math.max(0,INCOME-totalFixed-totalMSI-totalVar);
  const savRate=Math.round((free/INCOME)*100);
  const thisMoSavings=txs.filter(t=>t.cat==="Ahorro").reduce((s,t)=>s+Math.abs(t.amt),0);
  const savR=thisMoSavings/INCOME;
  const totUsed=CARDS.reduce((s,c)=>s+c.used,0), totLim=CARDS.reduce((s,c)=>s+c.lim,0);
  const creditUtil=(totUsed/totLim);
  const committedR=(totalFixed+totalMSI)/INCOME;

  const spentByGroup=txs.reduce((acc,tx)=>{ if(tx.amt>=0)return acc; const g=CAT_GROUP[tx.cat]; if(!g)return acc; acc[g]=(acc[g]||0)+Math.abs(tx.amt); return acc; },{});

  const factors = [
    { label:"Compromisos del ingreso", detail:`fijos+MSI = ${Math.round(committedR*100)}% comprometido`, pts:committedR<0.50?25:committedR<0.65?15:5, maxPts:25 },
    { label:"Tasa libre mensual",      detail:`${savRate}% disponible tras fijos, MSI y variables`,     pts:savRate>20?25:savRate>10?15:5, maxPts:25 },
    { label:"Utilización de crédito",  detail:`${Math.round(creditUtil*100)}% del límite total usado`,  pts:creditUtil<0.30?25:creditUtil<0.50?15:5, maxPts:25 },
    { label:"Ahorro del mes",          detail:`${Math.round(savR*100)}% del ingreso destinado a ahorro`,pts:savR>0.10?25:savR>0.05?15:5, maxPts:25 },
  ];
  const score = Math.min(100, factors.reduce((s,f)=>s+f.pts,0));

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

      {/* ── HERO: priority cards first ── */}
      <SCard style={{ gridColumn:"1/-1" }}>
        <Label>Presupuesto por prioridad — Mayo 2026</Label>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
          {PRIORITIES.map(p=>{
            const budget=groupBudgets[p]||0, actual=spentByGroup[p]||0;
            const pct=budget>0?(actual/budget)*100:0, meta=PM[p];
            const bmAmt=GROUP_BM[p].pct/100*INCOME;
            return (
              <div key={p} style={{ background:meta.bg, border:`1px solid ${meta.color}30`, borderRadius:14, padding:"16px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                  <div style={{ width:4, height:16, borderRadius:2, background:meta.color }}/>
                  <span style={{ color:meta.color, fontSize:13, fontWeight:700, fontFamily:F }}>{p}</span>
                </div>
                <div style={{ color:pct>100?C.red:meta.color, fontSize:22, fontWeight:700, fontFamily:F, marginBottom:4 }}>{fmt(actual)}</div>
                <div style={{ color:C.textDim, fontSize:11, fontFamily:F, marginBottom:10 }}>de {fmt(budget)} presupuestado</div>
                <ProgressBar value={actual} max={budget||1} color={meta.color} h={5}/>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                  <span style={{ color:C.textMuted, fontSize:11, fontFamily:F }}>{pct.toFixed(0)}%</span>
                  <span style={{ color:pct>100?C.red:pct>80?C.yellow:C.accent, fontSize:11, fontFamily:F, fontWeight:600 }}>{pct>100?"Excedido":pct>80?"En riesgo":pct>50?"En curso":"Bajo control"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </SCard>

      {/* ── Score con factores (secundario) ── */}
      <SCard style={{ padding:"18px 22px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:18 }}>
          <ScoreGauge score={score}/>
          <div>
            <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:4 }}>Score financiero</div>
            <div style={{ color:score>=70?C.accent:score>=40?C.yellow:C.red, fontSize:13, fontFamily:F }}>{score>=80?"Excelente":score>=60?"Bueno":score>=40?"Regular":"Crítico"} · {score}/100</div>
          </div>
        </div>
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
          {factors.map(f=><ScoreFactorRow key={f.label} {...f}/>)}
        </div>
      </SCard>

      {/* ── Ahorro (información secundaria) ── */}
      <SCard style={{ padding:"18px 22px" }}>
        <Label>Ahorro e inversión acumulado</Label>
        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:8 }}>
          <span style={{ color:C.accent, fontSize:32, fontWeight:700, fontFamily:F }}>{fmt(prevSavings+thisMoSavings)}</span>
          <span style={{ color:C.textMuted, fontSize:12, fontFamily:F }}>acumulado</span>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ color:C.textMuted, fontSize:11, fontFamily:F }}>Meta 20% del ingreso ({fmt(INCOME*0.20)}/mes)</span>
            <span style={{ color:savR>=0.20?C.accent:savR>0.10?C.yellow:C.red, fontSize:12, fontWeight:700, fontFamily:F }}>{Math.round(savR*100)}%</span>
          </div>
          <ProgressBar value={thisMoSavings} max={INCOME*0.20} color={C.accent} h={7}/>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          {[
            { lbl:"Este mes",          val:fmt(thisMoSavings), col:C.blue    },
            { lbl:"Acumulado anterior", val:fmt(prevSavings),   col:C.textDim },
          ].map(s=>(
            <div key={s.lbl} style={{ background:C.surface, borderRadius:10, padding:"12px 14px" }}>
              <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase", marginBottom:6 }}>{s.lbl}</div>
              <div style={{ color:s.col, fontSize:16, fontWeight:700, fontFamily:F }}>{s.val}</div>
            </div>
          ))}
        </div>
        {txs.filter(t=>t.cat==="Ahorro").length>0&&<>
          <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Instrumentos este mes</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {txs.filter(t=>t.cat==="Ahorro").map(tx=>(
              <div key={tx.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:C.surface, borderRadius:10, border:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>{tx.icon}</span>
                  <span style={{ color:C.textDim, fontSize:13, fontFamily:F }}>{tx.desc}</span>
                </div>
                <span style={{ color:C.accent, fontSize:13, fontWeight:700, fontFamily:F }}>{fmt(Math.abs(tx.amt))}</span>
              </div>
            ))}
          </div>
        </>}
      </SCard>

      {/* ── Budget vs real (primero) ── */}
      <SCard style={{ gridColumn:"1/-1" }}>
        <Label>Presupuesto vs real por categoría</Label>
        <div style={{ display:"flex", gap:20, marginBottom:16 }}>
          {[{col:C.blue,lbl:"Presupuesto",op:0.5},{col:C.accent,lbl:"Dentro del límite"},{col:C.red,lbl:"Excedido"}].map(l=>(
            <div key={l.lbl} style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:12, height:12, borderRadius:3, background:l.col, opacity:l.op||1 }}/><span style={{ color:C.textDim, fontSize:12, fontFamily:F }}>{l.lbl}</span></div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={BUDGET_VS_REAL} barGap={4} barCategoryGap="28%" margin={{ top:0, right:10, bottom:0, left:0 }}>
            <XAxis dataKey="cat" tick={{ fill:C.textDim, fontSize:12, fontFamily:F }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:C.textMuted, fontSize:11, fontFamily:F }} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}k`}/>
            <Tooltip cursor={{ fill:"transparent" }} content={<BudgetTip/>}/>
            <Bar dataKey="bud" name="Presupuesto" fill={C.blue} radius={[4,4,0,0]} opacity={0.45} activeBar={{ opacity:0.45 }}/>
            <Bar dataKey="real" name="Real" radius={[4,4,0,0]} activeBar={false}>{BUDGET_VS_REAL.map((e,i)=><Cell key={i} fill={e.real>e.bud?C.red:C.accent}/>)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </SCard>

      {/* ── Tendencia histórica ── */}
      <SCard style={{ gridColumn:"1/-1" }}>
        <Label>Gasto total histórico mensual</Label>
        <div style={{ display:"flex", gap:14, marginBottom:16, flexWrap:"wrap" }}>
          {EXP_CATS.map(cat=><div key={cat} style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:8, height:8, borderRadius:"50%", background:EXP_COLORS[cat] }}/><span style={{ color:C.textDim, fontSize:11, fontFamily:F }}>{cat}</span></div>)}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={EXPENSE_TREND} barCategoryGap="30%" margin={{ top:0, right:16, bottom:0, left:0 }}>
            <XAxis dataKey="m" tick={{ fill:C.textDim, fontSize:12, fontFamily:F }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:C.textMuted, fontSize:11, fontFamily:F }} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}k`}/>
            <Tooltip cursor={{ fill:"transparent" }} content={<ExpTrendTip/>}/>
            {EXP_CATS.map((cat,i)=>(
              <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={EXP_COLORS[cat]} maxBarSize={64}
                radius={i===EXP_CATS.length-1?[4,4,0,0]:[0,0,0,0]}/>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </SCard>
    </div>
  );
}

// ── BUDGET — with benchmark references per group ──────────────────────────────
function Budget({ groupBudgets, setGroupBudgets, income }) {
  const [cats,setCats]=useState(()=>BUDGET_CATS_DEFAULT.map(c=>({...c,priority:c.defaultP})));
  const [editGroup,setEditGroup]=useState(null); const [tempVal,setTempVal]=useState("");
  const [collapsed,setCollapsed]=useState({}); const [showPct,setShowPct]=useState(false);
  const INCOME=income;
  const totalBudget=Object.values(groupBudgets).reduce((s,v)=>s+v,0), remaining=INCOME-totalBudget;
  const saveGroup=p=>{ const v=parseFloat(tempVal); if(!isNaN(v)&&v>=0) setGroupBudgets(prev=>({...prev,[p]:showPct?Math.round(v/100*INCOME):v})); setEditGroup(null); };
  const updateP=(id,p)=>setCats(prev=>prev.map(c=>c.id===id?{...c,priority:p}:c));
  const displayBudget=v=>showPct?`${Math.round(v/INCOME*100)}%`:fmt(v);
  const pieDat=PRIORITIES.map(p=>({ name:p, value:groupBudgets[p]||0, color:PM[p].color }));

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        {[{lbl:"Ingreso mensual",val:fmt(INCOME),col:C.accent},{lbl:"Total presupuestado",val:fmt(totalBudget),col:totalBudget>INCOME?C.red:C.blue},{lbl:"Sin asignar",val:fmt(remaining),col:remaining<0?C.red:C.accent},{lbl:"Grupos",val:PRIORITIES.length,col:C.textDim}].map(m=>(
          <SCard key={m.lbl} style={{ padding:"16px 18px" }}>
            <div style={{ color:C.textMuted, fontSize:10, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>{m.lbl}</div>
            <div style={{ color:m.col, fontSize:20, fontWeight:700, fontFamily:F }}>{m.val}</div>
          </SCard>
        ))}
      </div>

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
        return (
          <div key={priority} style={{ marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:meta.bg, border:`1px solid ${meta.color}30`, borderRadius:12, marginBottom:isCollapsed?0:10 }}>
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
            {!isCollapsed&&<div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {group.map(cat=>(
                <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, fontFamily:F }}>
                  <span style={{ fontSize:22, flexShrink:0 }}>{cat.icon}</span>
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

// ── WHATSAPP BOT ──────────────────────────────────────────────────────────────
function WABot({ onAdd }) {
  const [open,setOpen]=useState(false);
  const [msgs,setMsgs]=useState([{ id:0, from:"bot", text:"Hola, soy ClarIA.\n\nEscríbeme un gasto y lo registro.\n\nEj: \"gasté 350 en tacos\"" }]);
  const [input,setInput]=useState(""); const [busy,setBusy]=useState(false);
  const endRef=useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);
  const send=async()=>{
    if(!input.trim()||busy)return;
    const txt=input.trim(); setInput(""); setBusy(true);
    setMsgs(m=>[...m,{id:Date.now(),from:"user",text:txt}]);
    await new Promise(r=>setTimeout(r,700+Math.random()*500));
    const n=(txt.match(/\d[\d,.]*/g)||[]).map(s=>parseFloat(s.replace(",","")))[0]||200;
    const isIn=/recib|ingres|cobr|salar/i.test(txt);
    const rules=[[/taco|pizza|sushi|comid|cena|rappi/i,"Comida","🍽️"],[/gasolina/i,"Transporte","⛽"],[/uber|taxi/i,"Transporte","🚗"],[/netflix|spotify|suscri/i,"Suscripciones","📱"],[/farma|medic/i,"Salud","💊"],[/walmart|super/i,"Supermercado","🛒"]];
    let cat="Otros",icon="💸";
    for(const[re,c,ic]of rules){if(re.test(txt)){cat=c;icon=ic;break;}}
    if(isIn){cat="Ingreso";icon="💰";}
    const tx={id:++_txId,date:todayStr(),desc:txt.slice(0,48),amt:isIn?n:-n,cat,icon,src:"whatsapp",cardId:null};
    onAdd(tx);
    setMsgs(m=>[...m,{id:Date.now()+1,from:"bot",text:`Registrado:\n${icon} ${tx.desc}\n${tx.amt<0?"−":"+"}${fmt(Math.abs(tx.amt))} · ${cat}`}]);
    setBusy(false);
  };
  return (
    <>
      <button onClick={()=>setOpen(o=>!o)} style={{ position:"fixed", bottom:28, right:28, width:54, height:54, borderRadius:"50%", background:open?C.border:C.wa, border:"none", cursor:"pointer", fontSize:22, boxShadow:`0 4px 24px rgba(37,211,102,${open?0.1:0.45})`, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>
        {open?"✕":"💬"}
      </button>
      {open&&<div style={{ position:"fixed", bottom:94, right:28, width:360, height:500, background:C.card, border:`1px solid ${C.border}`, borderRadius:20, display:"flex", flexDirection:"column", zIndex:199, boxShadow:"0 24px 72px rgba(0,0,0,0.6)", animation:"slideUp .25s ease" }}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:"50%", background:C.wa, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🤖</div>
          <div style={{ color:C.text, fontFamily:F, fontWeight:600 }}>ClarIA Bot</div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"12px", display:"flex", flexDirection:"column", gap:8 }}>
          {msgs.map(m=><div key={m.id} style={{ display:"flex", justifyContent:m.from==="user"?"flex-end":"flex-start" }}>
            <div style={{ maxWidth:"82%", padding:"10px 14px", borderRadius:m.from==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px", background:m.from==="user"?C.wa:C.surface, border:m.from==="bot"?`1px solid ${C.border}`:"none", color:m.from==="user"?"#fff":C.text, fontFamily:F, fontSize:13, lineHeight:1.5, whiteSpace:"pre-line" }}>{m.text}</div>
          </div>)}
          {busy&&<div style={{ display:"flex", gap:5, padding:"10px 14px", background:C.surface, borderRadius:12, width:"fit-content" }}>{[0,1,2].map(i=><div key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.textMuted, animation:`bounce 1s ease ${i*0.18}s infinite` }}/>)}</div>}
          <div ref={endRef}/>
        </div>
        <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="ej: gasté 250 en tacos…" style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:99, padding:"9px 16px", color:C.text, fontFamily:F, fontSize:13, outline:"none" }}/>
          <button onClick={send} disabled={busy} style={{ width:38, height:38, borderRadius:"50%", background:busy?C.border:C.accent, border:"none", cursor:busy?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.bg, fontSize:16 }}>➤</button>
        </div>
      </div>}
    </>
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

const TABS=[
  { id:"estado",       label:"Estado",        icon:"📊" },
  { id:"fixed",        label:"Gastos Fijos",  icon:"📌" },
  { id:"cards",        label:"Tarjetas",      icon:"💳" },
  { id:"msi",          label:"Planes MSI",    icon:"🔒" },
  { id:"budget",       label:"Presupuestos",  icon:"🎯" },
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
    ]).then(([dash,fijosData,msiData,grupos])=>{
      if(dash.ingreso) setIncome(Number(dash.ingreso));
      const txsApi=dash.ultimasTransacciones||[];
      if(txsApi.length) setTxs(txsApi.map(mapApiTx));
      if(!dash.ingreso||dash.ingreso===0) setOnboarding(true);
      if(fijosData.fijos?.length) setFixedItems(fijosData.fijos.map(mapApiFijo));
      if(msiData.msi?.length)     setMsiPlans(msiData.msi.map(mapApiMsi));
      if(grupos && Object.values(grupos).some(v=>v>0)) setGroupBudgets(grupos);
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
          <NotificationBell alerts={alerts}/>
          <button onClick={logout} title="Cerrar sesión"
            style={{ width:36, height:36, borderRadius:10, background:"transparent", border:`1px solid ${C.border}`, cursor:"pointer", color:C.textDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.color=C.red;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textDim;}}>⏻</button>
        </header>
        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 80px" }}>
          {tab==="estado"       &&<Estado        txs={txs} groupBudgets={groupBudgets} fixedItems={fixedItems} income={income} msiPlans={msiPlans} prevSavings={prevSavings}/>}
          {tab==="fixed"        &&<FixedExpenses items={fixedItems} setItems={setFixedItems} income={income}/>}
          {tab==="cards"        &&<CreditCards   txs={txs}/>}
          {tab==="msi"          &&<MSIPlans      plans={msiPlans}/>}
          {tab==="budget"       &&<Budget        groupBudgets={groupBudgets} setGroupBudgets={saveGroupBudgets} income={income}/>}
          {tab==="transactions" &&<Transactions  txs={txs} setTxs={setTxs} onAdd={addTx}/>}
        </div>
      </main>
      <WABot onAdd={addTx}/>
    </div>
  );
}
