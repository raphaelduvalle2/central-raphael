// Guarda os saldos num arquivo privado do app no Google Drive (appDataFolder):
// fica escondido, não aparece no seu Drive e só a Central acessa. Sem banco de dados.
import { PADRAO, type Saldos } from "./saldos";

const FILE = "saldos.json";
const API = "https://www.googleapis.com/drive/v3";
const UP = "https://www.googleapis.com/upload/drive/v3";

export class DriveScopeError extends Error {}

async function call(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) }, cache: "no-store" });
  if (res.status === 401 || res.status === 403) {
    const t = await res.text();
    if (/insufficient|scope|accessNotConfigured|has not been used|disabled/i.test(t) || res.status === 401)
      throw new DriveScopeError(t.slice(0, 200));
    throw new Error(`Drive ${res.status}: ${t.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`Drive ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

async function findId(token: string): Promise<string | null> {
  const q = new URLSearchParams({ spaces: "appDataFolder", q: `name='${FILE}'`, fields: "files(id)" });
  const r = await (await call(token, `${API}/files?${q}`)).json();
  return r.files?.[0]?.id ?? null;
}

export async function lerSaldos(token: string): Promise<Saldos> {
  const id = await findId(token);
  if (!id) return PADRAO;
  return (await call(token, `${API}/files/${id}?alt=media`)).json();
}

export async function salvarSaldos(token: string, s: Saldos) {
  const id = await findId(token);
  const body = JSON.stringify(s);
  if (id) {
    await call(token, `${UP}/files/${id}?uploadType=media`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body,
    });
    return;
  }
  const boundary = "central" + Date.now();
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE, parents: ["appDataFolder"] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  await call(token, `${UP}/files?uploadType=multipart`, {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart,
  });
}
