// Frases e paisagens para a tela calma. Uma combinação nova a cada vez que a Central abre.

export const FRASES: { texto: string; autor?: string }[] = [
  { texto: "O que é importante chega até você. O resto pode esperar a próxima janela." },
  { texto: "Você construiu um sistema para cuidar disso. Agora vá viver." },
  { texto: "Nenhum email vale mais do que este momento." },
  { texto: "Pegue o baixo. Toque por tocar, não por obrigação." },
  { texto: "A escola funciona sozinha. Você não precisa vigiar para ela existir." },
  { texto: "Responder rápido não é o mesmo que responder bem." },
  { texto: "Silêncio também é produtividade." },
  { texto: "O groove mais bonito nasce do espaço entre as notas. Deixe espaço no seu dia." },
  { texto: "Quem está ao seu lado agora merece mais atenção do que a tela." },
  { texto: "Se fosse urgente, a Central já teria te avisado." },
  { texto: "Respire fundo três vezes. Pronto: você já ganhou alguma coisa." },
  { texto: "Saia, caminhe, olhe o céu. As vendas continuam acontecendo." },
  { texto: "Automatize o que se repete. Viva o que não se repete." },
  { texto: "Você não é a sua caixa de entrada." },
  { texto: "O tempo que você não gasta conferindo volta para você inteiro." },
  { texto: "Pausa não é preguiça. É parte da música." },
  { texto: "Confie no processo que você mesmo desenhou." },
  { texto: "Menos abas abertas, mais vida aberta." },
  { texto: "Hoje, faça uma coisa só, e faça com presença." },
  { texto: "A ansiedade quer agora. A vida acontece no agora, mas em outro lugar." },
  { texto: "Não é preciso estar em todo lugar para estar presente." },
  { texto: "Toque devagar. Depois, viva devagar." },
  { texto: "Enquanto você lê isto, alguém está aprendendo baixo com o que você criou." },
  { texto: "Não é a vida que é curta. Nós é que a desperdiçamos.", autor: "Sêneca" },
  { texto: "Você tem poder sobre a sua mente, não sobre os acontecimentos. Perceba isso e encontrará força.", autor: "Marco Aurélio" },
  { texto: "A natureza não se apressa, e ainda assim tudo se realiza.", autor: "Lao Tsé" },
  { texto: "Enquanto adiamos, a vida passa.", autor: "Sêneca" },
  { texto: "Raramente pense no que te falta; pense no que você já tem.", autor: "Marco Aurélio" },
  { texto: "Quem conhece o suficiente é sempre rico.", autor: "Lao Tsé" },
  { texto: "Cuide do agora. É o único tempo em que se vive.", autor: "Marco Aurélio" },
];

// Fotos de natureza (Unsplash). Se alguma falhar, a tela cai para o fundo escuro.
const IDS = [
  "1506905925346-21bda4d32df4", // montanhas acima das nuvens
  "1441974231531-c6227db76b6e", // floresta com luz
  "1470071459604-3b5ec3a7fe05", // vale com neblina
  "1501785888041-af3ef285b470", // lago e montanhas
  "1500530855697-b586d89ba3ee", // estrada e campos
  "1469474968028-56623f02e42e", // pôr do sol na serra
  "1447752875215-b2761acb3c5d", // trilha na mata
  "1433086966358-54859d0ed716", // cachoeira
  "1507525428034-b723cf961d3e", // praia
  "1472214103451-9374bd1c798e", // colinas verdes
  "1418065460487-3e41a6c84dc5", // pinheiros e montanhas
  "1426604966848-d7adac402bff", // vale e rio
];
export const IMAGENS = IDS.map((id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1920&q=70`);

export type Inspira = { frase: (typeof FRASES)[number]; imagem: string };

export function sortear(): Inspira {
  const r = (n: number) => Math.floor(Math.random() * n);
  return { frase: FRASES[r(FRASES.length)], imagem: IMAGENS[r(IMAGENS.length)] };
}
