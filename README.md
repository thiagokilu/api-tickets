# 🎫 API Tickets

API REST para gerenciamento de tickets de suporte, desenvolvida com foco em organização, autenticação, controle de acesso e histórico de atendimento.

## 🛠️ Tecnologias

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

## ✨ Funcionalidades

- 🎫 Criação, edição e exclusão de tickets.
- 🔐 Autenticação de usuários e proteção de rotas.
- 👥 Atribuição de tickets a agentes de suporte.
- 🔄 Gerenciamento de status e prioridades.
- 💬 Envio de mensagens e comentários nos tickets.
- 📎 Anexos de arquivos aos tickets.
- 📋 Consulta do histórico de alterações.
- 🔎 Listagem e filtragem por status, prioridade e categoria.
- 🛡️ Controle de acesso conforme as permissões dos usuários.
- 🤖 Chat com IA usando o histórico enviado pelo cliente e o contexto de tickets.

## 🤖 Chat com IA

As rotas HTTP do chat exigem autenticação JWT. O endpoint `POST /chat` retorna a resposta completa; `POST /chat/stream` transmite a resposta em eventos SSE. O WebSocket usa o namespace `/chat` e recebe mensagens pelo evento `sendMessage`.

Para a IA continuar uma conversa, envie as mensagens anteriores em `history` junto com cada nova mensagem. O servidor não armazena o histórico do chat: o cliente deve reenviá-lo em ordem cronológica. Use `role: "user"` para mensagens da pessoa e `role: "model"` para respostas anteriores da IA. A mensagem atual vai no campo `message` e não deve ser repetida em `history`.

Exemplo de corpo para `POST /chat` (o mesmo formato vale para `/chat/stream` e para o payload do evento WebSocket `sendMessage`):

```json
{
  "history": [
    { "role": "user", "text": "Meu login não funciona." },
    { "role": "model", "text": "O que acontece quando você tenta entrar?" },
    { "role": "user", "text": "Aparece uma mensagem de senha incorreta." },
    { "role": "model", "text": "Você já tentou redefinir a senha?" }
  ],
  "message": "Ainda não. Como faço isso?",
  "ticketId": "<UUID-do-ticket-opcional>"
}
```

`history` é opcional e pode ser omitido na primeira mensagem. `ticketId` também é opcional; quando informado, a IA recebe o contexto daquele ticket, respeitando as permissões do usuário. Sem `ticketId`, o contexto inclui tickets abertos ou em andamento que o usuário pode consultar.

## 🚀 Como executar o projeto

### Pré-requisitos

- [Node.js](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/)
- [Docker](https://www.docker.com/)
- Docker Compose com a imagem `pgvector/pgvector`

### Instalação

1. Clone o repositório:

   ```bash
   git clone <URL_DO_REPOSITORIO>
   ```

2. Acesse a pasta do projeto:

   ```bash
   cd api-tickets
   ```

3. Instale as dependências:

   ```bash
   pnpm install
   ```

4. Crie o arquivo de ambiente a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

5. Configure as variáveis de ambiente no arquivo `.env`, incluindo as conexões com PostgreSQL e Redis e os segredos de autenticação necessários.

6. Inicie o PostgreSQL com `pgvector` e o Redis:

   ```bash
   docker compose up -d
   ```

7. Execute as migrations do banco de dados:

   ```bash
   pnpm prisma:migrate
   ```

8. Inicie o servidor em modo de desenvolvimento:

   ```bash
   pnpm start:dev
   ```

## 🧪 Testes

Execute os testes unitários:

```bash
pnpm test
```

Execute os testes end-to-end:

```bash
pnpm test:e2e
```

## 📁 Estrutura do projeto

A estrutura segue a organização modular do NestJS, separando responsabilidades por módulos e serviços.

```text
src/
├── auth/
├── tickets/
├── users/
├── app.module.ts
└── main.ts
```

*Os diretórios são ilustrativos; ajuste a estrutura conforme a organização real do repositório.*

## 🔒 Segurança

- Autenticação para acesso aos recursos protegidos.
- Validação dos dados recebidos pela API.
- Controle de permissões para operações sobre tickets.
- Configuração de credenciais e segredos por variáveis de ambiente.

## 📄 Licença

Este projeto foi desenvolvido para fins de estudo e demonstração de conhecimentos em desenvolvimento backend.


Avaliação: o projeto tem uma base boa para um MVP: está organizado em módulos NestJS e já inclui autenticação, controle de acesso, tickets, mensagens, anexos, histórico, chat, RAG e workflow de CI. Mas, pelo que revisei, eu ainda não o consideraria pronto para produção.

Os pontos que mais pesam:

- Falha de segurança no WebSocket: o chat apenas decodifica o conteúdo do JWT; não verifica sua assinatura nem sua validade. Isso pode permitir que alguém se conecte com um token forjado. Veja chat.gateway.ts (src/chat/chat.gateway.ts:126).
- O passo de migrations do README não corresponde aos scripts disponíveis: a documentação manda executar pnpm prisma:migrate, mas esse script não aparece no package.json (package.json:9). Também encontrei divergências entre README.md (README.md:71), .env.example, docker-compose.yml e compose.yml nas portas e no modo de iniciar os serviços.
- A configuração de ambiente é rígida: NVIDIA_API_KEY e as credenciais do Observe são obrigatórias para subir a aplicação, junto com banco, Redis e JWT. Isso complica a execução local e qualquer ambiente que não use esses serviços. Veja env.ts (src/config/env/env.ts:17) e app.module.ts (src/app.module.ts:14).
- Há riscos operacionais para revisar: o ingresso RAG depende da API NVIDIA durante a inicialização (rag-ingestion.service.ts (src/rag-ingestion/rag-ingestion.service.ts:19)); e os anexos são armazenados no disco local, o que exige uma estratégia de persistência e backup no deploy.

Resumo: está bem encaminhado como projeto de estudo ou MVP, mas antes de chamar de pronto eu corrigiria a validação do JWT no WebSocket, deixaria a inicialização previsível sem integrações opcionais e alinharia documentação, scripts e Compose. Não executei build nem testes; esta avaliação foi uma revisão estática dos arquivos.
