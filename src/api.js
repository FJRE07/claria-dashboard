const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const getToken = () => localStorage.getItem("claria_token");

async function req(method, path, body) {
  const opts = { method, headers: {} };
  const token = getToken();
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(`${BASE}${path}`, opts);
  if (r.status === 401) {
    localStorage.removeItem("claria_token");
    window.location.reload();
    throw new Error("Sesión expirada");
  }
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`API ${r.status}${msg ? ": " + msg.slice(0, 120) : ""}`);
  }
  return r.json();
}

export const login          = (email, password) => req("POST", "/auth/login", { email, password });
export const setup          = (email, password) => req("POST", "/auth/setup", { email, password });
export const getDashboard   = (periodo) => req("GET", `/api/dashboard?periodo=${periodo}`);
export const getGastos      = (params = {}) => req("GET", `/api/gastos?${new URLSearchParams(params)}`);
export const postGasto      = (data) => req("POST", "/api/gastos", data);
export const putGasto       = (id, data) => req("PUT", `/api/gastos/${id}`, data);
export const deleteGasto    = (id) => req("DELETE", `/api/gastos/${id}`);
export const getFijos       = () => req("GET", "/api/fijos");
export const postFijo       = (data) => req("POST", "/api/fijos", data);
export const putFijo        = (id, data) => req("PUT", `/api/fijos/${id}`, data);
export const deleteFijo     = (id) => req("DELETE", `/api/fijos/${id}`);
export const getMSI         = () => req("GET", "/api/msi");
export const getPresupuesto = () => req("GET", "/api/presupuesto");
export const getTendencia   = (meses = 6) => req("GET", `/api/tendencia?meses=${meses}`);
export const importCSV      = (csvText)   => req("POST", "/api/import/csv", { csv: csvText });
export const health         = () => req("GET", "/health");
