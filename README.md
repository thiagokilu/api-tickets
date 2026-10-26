# 🎫 API Tickets

API REST para gerenciamento de tickets de suporte, desenvolvida com foco em organização, autenticação, controle de acesso e histórico de atendimento.

## 🛠️ Tecnologias

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)

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

## 🚀 Como executar o projeto

### Pré-requisitos

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/)

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

6. Execute as migrations do banco de dados:

   ```bash
   pnpm prisma:migrate
   ```

7. Inicie o servidor em modo de desenvolvimento:

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
