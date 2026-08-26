
# Brazil Label — CRM Online

Sistema web com login, banco SQLite e módulos de clientes, oportunidades, orçamentos, tarefas e dashboard.

## Rodar no computador
1. Instale Node.js 20+.
2. Abra o terminal nesta pasta.
3. Execute `npm install`.
4. Execute `npm start`.
5. Abra `http://localhost:3000`.

## Acesso inicial
- E-mail: `admin@brazillabel.com.br`
- Senha: `Brazil@123`

**Troque a senha antes de colocar em produção.**

## Publicação online
O projeto foi preparado para hospedagem Node.js. Use uma hospedagem que permita Node.js e armazenamento persistente para o SQLite, ou troque o banco por PostgreSQL em produção.

Variáveis recomendadas:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `DB_FILE`

## WhatsApp
O catálogo/formulário anterior da Brazil Label usa o número `55 92 98146-3334`. A integração com WhatsApp pode ser ligada ao CRM quando o catálogo público for integrado a este backend.
