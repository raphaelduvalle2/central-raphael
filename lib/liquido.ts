// Regra do Raphael para o líquido (média prática, não o valor exato da plataforma):
// - Cartão (qualquer parcelamento): venda de R$ 597 deixa ≈ R$ 540 → 540/597
// - Pix: venda de R$ 597 deixa ≈ R$ 590 → 590/597
// Forma de pagamento desconhecida conta como cartão (mais conservador).
export type Method = "cartao" | "pix";

export const LIQUIDO: Record<Method, number> = {
  cartao: 540 / 597,
  pix: 590 / 597,
};

export function paymentMethod(text: string): Method {
  return /\bpix\b/i.test(text) ? "pix" : "cartao";
}

export function estimateNet(gross: number, method: Method) {
  return Math.round(gross * LIQUIDO[method] * 100) / 100;
}
