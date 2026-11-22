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

async function findId(token: string, file: string): Promise<string | null> {
  const q = new URLSearchParams({ spaces: "appDataFolder", q: `name='${file}'`, fields: "files(id)" });
  const r = await (await call(token, `${API}/files?${q}`)).json();
  return r.files?.[0]?.id ?? null;
}

export async function lerJson<T>(token: string, file: string, padrao: T): Promise<T> {
  const id = await findId(token, file);
  if (!id) return padrao;
  return (await call(token, `${API}/files/${id}?alt=media`)).json();
}

export async function salvarJson(token: string, file: string, data: unknown) {
  const id = await findId(token, file);
  const body = JSON.stringify(data);
  if (id) {
    await call(token, `${UP}/files/${id}?uploadType=media`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body,
    });
    return;
  }
  const boundary = "central" + Date.now();
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: file, parents: ["appDataFolder"] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  await call(token, `${UP}/files?uploadType=multipart`, {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart,
  });
}

export const lerSaldos = (token: string) => lerJson<Saldos>(token, FILE, PADRAO);
export const salvarSaldos = (token: string, s: Saldos) => salvarJson(token, FILE, s);

/** Comentários do YouTube já resolvidos (guardamos só os ids, os mais recentes). */
const FEITOS = "youtube-feitos.json";
export const lerFeitosYT = (token: string) => lerJson<string[]>(token, FEITOS, []);
export async function marcarFeitosYT(token: string, ids: string[]) {
  const atual = await lerFeitosYT(token);
  const novo = [...new Set([...ids, ...atual])].slice(0, 1000);
  await salvarJson(token, FEITOS, novo);
}
