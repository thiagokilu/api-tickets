[ ] RF01 — Criar ticket: o usuário deve poder criar um ticket informando título, descrição, prioridade e categoria.

[ ] RF02 — Excluir ticket: o usuário deve poder excluir um ticket, respeitando as permissões definidas pelo sistema.

[ ] RF03 — Editar ticket: o usuário deve poder editar as informações de um ticket existente.

[ ] RF04 — Atualizar status: o usuário autorizado deve poder alterar o status de um ticket, por exemplo, de OPEN para IN_PROGRESS.

[ ] RF05 — Adicionar arquivos: o usuário deve poder anexar arquivos a um ticket.

[ ] RF06 — Listar tickets: o usuário deve poder visualizar os tickets aos quais tem acesso.

[ ] RF07 — Consultar ticket: o usuário deve poder visualizar os detalhes de um ticket específico.

[ ] RF08 — Comentar no ticket: o usuário deve poder adicionar mensagens ou comentários a um ticket.

[ ] RF09 — Consultar histórico: o sistema deve permitir consultar o histórico de alterações de um ticket.

[ ] RF10 — Autenticar usuário: o sistema deve permitir que usuários façam login para acessar os recursos protegidos.

[ ] RF11 — Atribuir responsável: um agente ou administrador autorizado deve poder atribuir um ticket a um agente.

[ ] RF12 — Filtrar tickets: o usuário deve poder filtrar tickets por status, prioridade e categoria.
# api-tickets


Há também riscos na criação e atualização:

- Todo ticket novo é atribuído ao próprio solicitante (assigned_to_id: userId), embora o campo seja opcional no schema. Isso pode fazer o sistema tratar o cliente como agente responsável. tickets.service.ts (src/tickets.service.ts:17)
- O cliente pode enviar status, datas de resolução/fechamento e timestamps na criação. Assim, pode criar um ticket já resolvido ou alterar datas que deveriam ser controladas pelo servidor. create-ticket.dto.ts (src/tickets/dto/create-ticket.dto.ts:2)
- O mesmo DTO é usado na atualização, então a autorização atual permite ao solicitante mudar campos de status e prioridade. Se essas transições devem ser feitas por agentes, será necessário restringir os campos por papel e validar as transições permitidas.

Prioridade sugerida: proteger todos os endpoints e definir quem pode ver, editar e excluir cada ticket; depois, separar os campos aceitos na criação e na atualização. Também vale alinhar as opções do DTO ao schema: o schema inclui WAITING_FOR_CUSTOMER e URGENT, que não aparecem no DTO. schema.prisma (prisma/schema.prisma:60)

Este feedback é uma revisão estática da implementação em desenvolvimento; não alterei os arquivos nem executei testes.
  Worked for 41s • 3:01 PM


  Em tickets.service.ts (src/tickets/tickets.service.ts:325), na atualização do ticket. O DTO permite enviar status, e o serviço aceita esse valor sem conferir se a mudança é válida para o status atual. Por exemplo, um agente pode mudar diretamente de OPEN para CLOSED.

Se essa regra for desejada, você pode validar as transições permitidas antes de atualizar. A implementação atual verifica se o agente está atribuído ao ticket, mas não restringe a sequência de status.