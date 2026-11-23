// Carrinho abandonado: o aviso do TMBX traz nome e WhatsApp. A Central monta a mensagem padrão
// e abre o WhatsApp Business do computador já com o texto pronto. Você só aperta Enter.
import type { Mail } from "./gmail";

/** Edite aqui o texto padrão. {nome} vira o primeiro nome da pessoa. */
export const MENSAGEM =
  "Oi, {nome}! Aqui é do ToqueMaisBaixo. Vi que você começou a compra do Curso Completo de Contrabaixo e não conseguiu concluir. Posso te ajudar com alguma dúvida?";

export type Carrinho = { id: string; nome: string; produto: string; telefone: string; date: Date; mail: Mail };

const capitalizar = (s: string) => s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1).toLocaleLowerCase("pt-BR");
export const primeiroNome = (nome: string) => capitalizar((nome.trim().split(/\s+/)[0] || "tudo bem"));

export function parseCarrinho(m: Mail): Carrinho | null {
  if (!/^Carrinho:/i.test(m.subject)) return null;
  const parts = m.subject.replace(/^Carrinho:\s*/i, "").split("·").map((s) => s.trim());
  const nome = parts[0] || "";
  const produto = parts.slice(1).join(" · ");
  const tel = m.body.match(/wa\.me\/(\d{10,15})/)?.[1] || m.body.match(/\+?(55\d{10,11})/)?.[1] || "";
  if (!tel) return null;
  return { id: m.id, nome, produto, telefone: tel, date: m.date, mail: m };
}

export function textoPara(nome: string) {
  return MENSAGEM.replace("{nome}", primeiroNome(nome));
}

/** Abre direto o app do WhatsApp (Business) instalado no computador. */
export const linkApp = (tel: string, texto: string) => `whatsapp://send?phone=${tel}&text=${encodeURIComponent(texto)}`;
/** Alternativa: WhatsApp Web no navegador. */
export const linkWeb = (tel: string, texto: string) => `https://web.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(texto)}`;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Agrupa por telefone (fica o mais recente) e separa quem já comprou depois do carrinho.
 * Retorna os carrinhos para agir e os ids que podem ser arquivados sozinhos.
 */
export function triarCarrinhos(carrinhos: Carrinho[], vendas: { who: string; date: string }[]) {
  const porTel = new Map<string, Carrinho[]>();
  for (const c of carrinhos) porTel.set(c.telefone, [...(porTel.get(c.telefone) || []), c]);
  const agir: { carrinho: Carrinho; antigos: string[] }[] = [];
  const compraram: string[] = [];
  for (const lista of porTel.values()) {
    lista.sort((a, b) => b.date.getTime() - a.date.getTime());
    const [atual, ...antigos] = lista;
    const comprou = vendas.some((v) => norm(v.who) === norm(atual.nome) && new Date(v.date) >= atual.date);
    if (comprou) compraram.push(...lista.map((c) => c.id));
    else agir.push({ carrinho: atual, antigos: antigos.map((c) => c.id) });
  }
  return { agir, compraram };
}
