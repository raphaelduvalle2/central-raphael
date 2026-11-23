// Duvalle Solo: agente de shows. Banco de contatos, editais, modelos de email e follow-up.

export type Status = "pesquisar" | "a_contatar" | "enviado" | "respondeu" | "negociando" | "fechado" | "recusado";
export type Categoria = "jazz" | "gastronomia" | "literario" | "sesc" | "cultural";
export type Idioma = "pt" | "en" | "es";

export type Evento = { data: string; tipo: "nota" | "email" | "followup" | "resposta" | "status"; texto: string };

export type Contato = {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  categoria: Categoria;
  quando?: string; // época do evento
  site?: string;
  email?: string;
  telefone?: string;
  instagram?: string;
  como?: string; // como contatar / quem procurar
  porque?: string; // por que combina com o show (usado no email)
  fonte?: string;
  idioma: Idioma;
  status: Status;
  threadId?: string;
  enviadoEm?: string;
  followups: number;
  historico: Evento[];
};

export type EditalStatus = "novo" | "lavinia" | "inscrito" | "resultado" | "descartado";
export type Edital = {
  id: string; titulo: string; orgao: string; prazo?: string; valor?: string; link: string;
  resumo: string; status: EditalStatus; encontradoEm: string;
};

export type Banco = { contatos: Contato[]; editais: Edital[]; versao: 1 };

export const STATUS_LABEL: Record<Status, string> = {
  pesquisar: "Achar contato", a_contatar: "A contatar", enviado: "Enviado", respondeu: "Respondeu",
  negociando: "Negociando", fechado: "Fechado", recusado: "Recusado",
};
export const CATEGORIA_LABEL: Record<Categoria, string> = {
  jazz: "Festival de jazz", gastronomia: "Gastronomia e vinho", literario: "Festival literário",
  sesc: "Sesc", cultural: "Festival / centro cultural",
};

export const LAVINIA = "laviniaduvalle@gmail.com";
export const FOLLOWUP_DIAS = 7;
export const FOLLOWUP_MAX = 2;

// --- Modelos de email ----------------------------------------------------------

const LINKS = {
  site: "https://www.raphaelduvalle.com",
  spotify: "https://open.spotify.com/intl-pt/artist/0dRE7BvpVzrtnJ47gsZKEG",
  instagram: "https://www.instagram.com/raphaelduvalle/",
  rider: "https://central-raphael.vercel.app/epk/rider-solo.jpg",
};

const GANCHO: Record<Categoria, string> = {
  jazz:
    "Acompanho o {evento} e acredito que o show conversa muito bem com a curadoria do festival: música instrumental brasileira com linguagem de jazz e improvisação, num instrumento que raramente aparece sozinho no palco.",
  gastronomia:
    "Penso que ele combina com a proposta do {evento}: é um show intimista e elegante, que cria um ambiente sofisticado para degustações, jantares e momentos de convivência, sem disputar a atenção com a experiência gastronômica.",
  literario:
    "Imagino o show na programação do {evento} como um momento de pausa e escuta entre mesas e encontros, que também pode ganhar formato de conversa sobre processo criativo.",
  sesc:
    "Penso nele para a programação do {evento}, tanto no formato show quanto no formato Masterclass, que costuma funcionar muito bem com o público do Sesc.",
  cultural:
    "Penso nele para a programação do {evento}: é um espetáculo intimista e de estrutura técnica enxuta.",
};

// "do" ou "da" conforme o nome (Casa Fiat → da; Festival → do).
const FEM = ["casa", "semana", "feira", "mostra", "bienal", "festa", "jornada", "virada", "rede", "fundação", "fundacao", "sala", "temporada", "noite", "flip", "flica", "flup"];
export const dode = (nome: string) => (FEM.includes(nome.trim().split(/\s+/)[0]?.toLowerCase()) ? "da" : "do");

export function emailInicial(c: Contato) {
  if (c.idioma !== "pt") return emailEstrangeiro(c);
  const d = dode(c.nome);
  const gancho = GANCHO[c.categoria].replace(/do \{evento\}/g, `${d} ${c.nome}`).replace("{evento}", c.nome);
  const assunto = `DuValle nas 7 Cordas · show solo de baixo para ${d === "da" ? "a" : "o"} ${c.nome}`;
  const corpo = `Olá, equipe ${d} ${c.nome}, tudo bem?

Sou Raphael du Valle, contrabaixista, compositor e educador mineiro, e gostaria de apresentar o DuValle nas 7 Cordas, meu show solo.

${gancho}

No palco, o contrabaixo elétrico de 7 cordas deixa a função tradicional de acompanhamento e conduz sozinho toda a música: melodia, harmonia, linha de baixo, ritmo e improvisação acontecem no mesmo instrumento, ao vivo e sem bases gravadas. O repertório reúne composições próprias e releituras de clássicos brasileiros e internacionais, passando pela música brasileira, pelo jazz e pelo pop, numa leitura acessível tanto a quem conhece música instrumental quanto a quem nunca prestou atenção no baixo.

São mais de três décadas de pesquisa com o instrumento, quatro álbuns autorais e a fundação do ToqueMaisBaixo, primeira escola online de contrabaixo do Brasil, com mais de 5 mil alunos formados. Em 2025, fiz uma turnê de nove shows pela Espanha.

Com montagem enxuta (um músico e um instrumento), o show se adapta a teatros, auditórios, festivais, cafés, eventos gastronômicos e espaços ao ar livre. Também ofereço o formato Masterclass, que intercala apresentação e conversa sobre processo criativo e técnica.

Envio em anexo o press kit. Mais informações:
Site: ${LINKS.site}
Spotify: ${LINKS.spotify}
Instagram: ${LINKS.instagram}
Rider técnico: ${LINKS.rider}

Seria um prazer conversar sobre uma data. Fico à disposição por aqui ou pelo WhatsApp (35) 99264-6654.

Um abraço,
Raphael du Valle
www.raphaelduvalle.com`;
  return { assunto, corpo };
}

function emailEstrangeiro(c: Contato) {
  if (c.idioma === "es") {
    return {
      assunto: `Raphael du Valle · concierto solista de bajo de 7 cuerdas para ${c.nome}`,
      corpo: `Hola, equipo de ${c.nome}:

Soy Raphael du Valle, bajista, compositor y productor brasileño, con más de 30 años de trayectoria y cuatro discos de autor (el más reciente, "Latino Americano"). Este año realicé la Gira Latinoamericana por España y Portugal.

Me gustaría presentarles mi concierto solista en el bajo de 7 cuerdas: una experiencia íntima con composiciones propias y relecturas de clásicos de la música brasileña y latinoamericana, entre el jazz, los ritmos latinos y la world music. También ofrezco formato Masterclass.

La estructura técnica es sencilla (amplificador de bajo, DI, un micrófono y dos monitores). Adjunto el dossier de prensa.

Web: ${LINKS.site}
Spotify: ${LINKS.spotify}

Sería un placer conversar sobre una posible fecha.

Un abrazo,
Raphael du Valle`,
    };
  }
  return {
    assunto: `Raphael du Valle · solo 7-string bass concert for ${c.nome}`,
    corpo: `Hello ${c.nome} team,

I'm Raphael du Valle, a Brazilian bassist, composer and producer with over 30 years on stage and four original albums (the latest, "Latino Americano"). This year I toured Spain and Portugal with the Latin American Tour.

I'd love to present my solo 7-string bass concert: an intimate performance of original compositions and new takes on Brazilian and Latin American classics, between jazz, Latin rhythms and world music. A Masterclass format is also available.

Technical needs are minimal (bass amp, DI, one mic and two monitors). Please find my press kit attached.

Website: ${LINKS.site}
Spotify: ${LINKS.spotify}

It would be a pleasure to talk about a possible date.

Best regards,
Raphael du Valle`,
  };
}

export function emailFollowup(c: Contato) {
  const n = c.followups + 1;
  if (c.idioma === "en")
    return `Hello again! Just following up on my message about the solo 7-string bass concert. Happy to send any extra information or adapt the format to your program.\n\nBest,\nRaphael du Valle`;
  if (c.idioma === "es")
    return `¡Hola de nuevo! Solo quería retomar mi mensaje sobre el concierto solista de bajo de 7 cuerdas. Quedo a disposición para enviar más información o adaptar el formato a su programación.\n\nUn abrazo,\nRaphael du Valle`;
  return n === 1
    ? `Olá, tudo bem? Passando para saber se vocês conseguiram ver minha mensagem sobre o DuValle nas 7 Cordas, meu show solo de baixo, para ${dode(c.nome) === "da" ? "a" : "o"} ${c.nome}. Fico à disposição para mandar mais material ou adaptar o formato à programação de vocês.\n\nUm abraço,\nRaphael du Valle\n(35) 99264-6654`
    : `Olá! Retomo o contato uma última vez sobre o DuValle nas 7 Cordas. Se não for o momento agora, sem problemas: deixo meu material com vocês para futuras edições. Seria uma alegria tocar aí.\n\nUm abraço,\nRaphael du Valle`;
}

export const EPK_ARQUIVO: Record<Idioma, string> = {
  pt: "raphael-du-valle-epk-pt.pdf",
  en: "raphael-du-valle-epk-en.pdf",
  es: "raphael-du-valle-epk-es.pdf",
};

export const novoId = () => Math.random().toString(36).slice(2, 10);
