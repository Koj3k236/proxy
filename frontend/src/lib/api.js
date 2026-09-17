import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export function countryFlag(code) {
  if (!code || code.length !== 2) return "🌐";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function errMsg(e) {
  return e?.response?.data?.detail || e?.message || "Terjadi kesalahan";
}
