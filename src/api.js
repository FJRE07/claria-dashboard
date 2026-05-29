const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function req(method, path, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`API ${r.status}${msg ? ": " + msg.slice(0, 120) : ""}`);
  }
  return r.json();
}

export const getDashboard   = (periodo) => req("GET", `/api/dashboard?periodo=${periodo}`);
export const getGastos      = (params = {}) => req("GET", `/api/gastos?${new URLSearchParams(params)}`);
export const postGasto      = (data) => req("POST", "/api/gastos", data);
export const getFijos       = () => req("GET", "/api/fijos");
export const getMSI         = () => req("GET", "/api/msi");
export const getPresupuesto = () => req("GET", "/api/presupuesto");
export const health         = () => req("GET", "/health");
