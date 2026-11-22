# Central

Dashboard pessoal do Raphael. Lê o Gmail, separa o que precisa de decisão e esconde o resto.

- **Fora das janelas** (9h00, 13h00, 17h30, 30 min cada): tela calma, sem números. Só aparece o urgente: chamado, dúvida de aluno, email do Gui.
- **Dentro da janela:** decisões, vendas do dia e do mês (bruto do aviso TMBX + líquido da Levvex) e resumo do que foi filtrado.
- **"Feito ✓"** marca o email com `Central/Feito` e tira da caixa de entrada. Não há banco de dados: o estado mora no próprio Gmail.
- **Acesso:** login Google liberado só para `ALLOWED_EMAIL`.

As janelas ficam em `lib/windows.ts` e as regras de triagem em `lib/briefing.ts`.

## Configuração (uma vez)

### 1. Google Cloud (login + Gmail)
1. Em https://console.cloud.google.com, crie um projeto (ex.: "Central").
2. Ative a **Gmail API**.
3. Configure a tela de consentimento OAuth: tipo **Externo**, app em modo **Teste**, e adicione `raphaelduvalle@gmail.com` como usuário de teste.
4. Crie as credenciais em **ID do cliente OAuth** → **Aplicativo da Web**, com os URIs de redirecionamento:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://SEU-PROJETO.vercel.app/api/auth/callback/google`
5. Copie o Client ID e o Client Secret.

> No modo Teste, o Google expira a autorização a cada 7 dias. Nesse caso, basta entrar de novo.

### 2. Vercel
1. Importe o repositório `central-raphael`.
2. Em **Environment Variables**, cadastre as variáveis do `.env.example`, com `NEXTAUTH_URL` apontando para a URL da Vercel.
3. Faça o deploy.

### Rodar local
```bash
cp .env.example .env.local   # preencha
npm install --legacy-peer-deps
npm run dev
```
