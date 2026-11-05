# Guia de Soluções de Problemas — Suporte

Use este guia para atender chamados de forma padronizada. Antes de escalar, colete: **nome do usuário, empresa/tenant, tela ou módulo, horário, navegador/app/versão, mensagem de erro, print e ID do erro/correlation ID**.

## 1. Resetar senha

### Problema
O usuário esqueceu a senha ou não consegue entrar.

### Solução
1. Confirme a identidade do usuário conforme a política de segurança.
2. Solicite que ele use a opção **“Esqueci minha senha”** na tela de login.
3. Verifique se o e-mail de redefinição chegou; peça para conferir **Spam, Lixeira e abas Promociones**.
4. Se o e-mail não chegou em até 5 minutos:
   - Confirme se o e-mail cadastrado está correto.
   - Verifique se o domínio não está bloqueando mensagens.
   - Reenvie o link, se disponível.
5. Se o link expirou, gere um novo.
6. Oriente o usuário a criar uma senha forte e diferente das anteriores.

### Escalar quando
- O e-mail está correto, mas a redefinição falha.
- Há suspeita de acesso indevido.
- A conta está bloqueada por tentativas inválidas.

---

## 2. Conta bloqueada

### Problema
Mensagem de conta bloqueada, usuário suspenso ou tentativas excessivas.

### Solução
1. Confirme a identidade do usuário.
2. Verifique o motivo do bloqueio no painel administrativo.
3. Se for bloqueio por tentativas, aguarde o período definido ou desbloqueie conforme política.
4. Se for bloqueio administrativo, confirme com o gestor responsável antes de liberar.
5. Após liberar, solicite redefinição de senha.

### Escalar quando
- O bloqueio é recorrente.
- Há indício de comprometimento da conta.

---

## 3. Erro ao criar um registro

Exemplos: criar usuário, cliente, pedido, produto, ticket, projeto ou tarefa.

### Problema
Ao clicar em **Salvar/Criar**, aparece erro, nada acontece ou o item não aparece na lista.

### Solução
1. Peça a mensagem exata e um print da tela.
2. Verifique campos obrigatórios, formato de e-mail, CPF/CNPJ, datas e valores.
3. Confirme se o usuário tem permissão para criar aquele tipo de registro.
4. Recarregue a página ou feche e abra o aplicativo.
5. Teste em outro navegador, aba anônima ou dispositivo.
6. Verifique se há duplicidade: e-mail, código, documento, nome ou chave única.
7. Se o erro continuar, colete o **ID do erro/correlation ID** e os dados informados.
8. Consulte os logs do backend usando o ID e o horário informado.

### Mensagens comuns

| Mensagem | Causa provável | Ação |
|---|---|---|
| “Campo obrigatório” | Informação não preenchida | Preencher o campo destacado |
| “E-mail inválido” | Formato incorreto | Corrigir o formato, ex.: nome@dominio.com |
| “Registro já existe” | Duplicidade | Buscar o registro existente ou alterar o dado único |
| “Permissão negada” | Usuário sem papel adequado | Solicitar acesso ao administrador |
| “Erro interno do servidor” | Falha no backend/integração | Coletar ID do erro e escalar para TI |
| “Tempo limite excedido” | Lentidão ou instabilidade | Repetir após alguns minutos; verificar status dos serviços |

---

## 4. Erro ao editar ou excluir

### Problema
Não é possível editar, salvar alterações ou excluir um item.

### Solução
1. Verifique se o registro está bloqueado, arquivado, concluído ou em uso por outro processo.
2. Confirme permissões de edição/exclusão.
3. Verifique se há dependências: por exemplo, um cliente com pedidos abertos pode não poder ser excluído.
4. Atualize a página e tente novamente.
5. Se for exclusão, confirme se a ação exige aprovação ou se existe lixeira/soft delete.
6. Colete o ID do erro caso persista.

### Escalar quando
- O dado ficou inconsistente.
- A exclusão afeta registros financeiros, fiscais ou de auditoria.

---

## 5. Não consigo fazer login

### Problema
Usuário informa credenciais corretas, mas não entra.

### Solução
1. Confirme e-mail/usuário e senha.
2. Verifique Caps Lock, teclado e método de entrada.
3. Teste redefinir a senha.
4. Limpe cache e cookies ou use janela anônima.
5. Teste outro navegador ou dispositivo.
6. Verifique se o serviço de autenticação está operacional.
7. Se houver MFA/2FA, confirme se o código está sendo gerado no app ou SMS correto.

### Escalar quando
- O login falha para vários usuários.
- O problema começou após atualização ou manutenção.
- Há suspeita de fraude ou conta comprometida.

---

## 6. Erro de permissão / acesso negado

### Problema
Mensagem como “Você não tem permissão”, “Acesso negado” ou menu indisponível.

### Solução
1. Confirme qual ação o usuário tenta executar.
2. Verifique o perfil, papel ou grupo de acesso do usuário.
3. Compare com outro usuário que consegue executar a ação.
4. Solicite a liberação ao administrador, se fizer sentido.
5. Após alterar permissões, peça logout/login ou atualização da sessão.

### Escalar quando
- O usuário deveria ter acesso e a permissão está configurada corretamente.
- Há erro após mudança de cargo, setor ou empresa.

---

## 7. Página lenta ou travando

### Problema
Tela demora para carregar, aplicativo congela ou fica em “carregando”.

### Solução
1. Atualize a página ou reinicie o aplicativo.
2. Verifique a conexão de internet.
3. Limpe cache e cookies.
4. Feche abas e aplicativos desnecessários.
5. Teste em outro navegador, rede ou dispositivo.
6. Verifique se o problema é geral ou apenas para um usuário.
7. Verifique monitoramento de latência, CPU, memória e banco de dados.

### Escalar quando
- A lentidão afeta vários usuários.
- Há erros 500, 502, 503 ou timeout.
- O problema ocorre em horário específico ou após uma publicação.

---

## 8. Aplicativo não abre ou fecha sozinho

### Problema
O app fecha inesperadamente, fica preto ou não carrega.

### Solução
1. Feche completamente o aplicativo e abra novamente.
2. Reinicie o dispositivo.
3. Verifique se há atualização disponível na loja de aplicativos.
4. Libere espaço de armazenamento, se necessário.
5. Limpe o cache do aplicativo, quando disponível.
6. Reinstale o aplicativo apenas após orientar sobre possíveis dados locais.
7. Verifique compatibilidade com a versão do sistema operacional.

### Escalar quando
- O crash ocorre sempre na mesma tela.
- Há relatos de vários usuários.
- O problema persiste após reinstalação.

---

## 9. Erro ao enviar e-mail ou notificação

### Problema
E-mail, SMS, push ou notificação não chega.

### Solução
1. Confirme o destinatário cadastrado.
2. Peça para verificar Spam, Lixeira e filtros.
3. Confirme se as notificações estão habilitadas no dispositivo e no sistema.
4. Verifique se o serviço de e-mail/SMS/push está operacional.
5. Reenvie a notificação, se possível.
6. Consulte logs de entrega e erros de bounce, bloqueio ou limite de envio.

### Escalar quando
- Vários destinatários não recebem.
- Há erro de autenticação no provedor de e-mail/SMS.
- O domínio está em blacklist.

---

## 10. Erro em integração ou pagamento

### Problema
Falha ao integrar com ERP, CRM, gateway de pagamento, API externa, e-mail ou outro sistema.

### Solução
1. Identifique o sistema integrado e o fluxo afetado.
2. Verifique se o serviço externo está disponível.
3. Confira credenciais, tokens, certificados e permissões da API.
4. Verifique se houve alteração recente na API, webhook ou contrato.
5. Consulte logs e o correlation ID da requisição.
6. Confirme se houve duplicidade antes de reprocessar qualquer transação.
7. Para pagamento, nunca confirme manualmente sem validar o status no gateway e no sistema interno.

### Escalar quando
- Há transação pendente, duplicada ou divergente.
- O erro afeta valores financeiros.
- O webhook não está sendo recebido.

---

## 11. Dados não aparecem ou aparecem errados

### Problema
Lista vazia, registro desaparece, valor incorreto ou dado desatualizado.

### Solução
1. Atualize a página ou sincronize o aplicativo.
2. Confirme filtros, período, empresa/filial e permissões aplicadas.
3. Verifique se o usuário está olhando o ambiente correto, como produção, homologação ou sandbox.
4. Confirme se o dado foi realmente salvo.
5. Consulte o banco ou logs para verificar o estado do registro.
6. Verifique cache, fila de sincronização ou job agendado.

### Escalar quando
- Há divergência entre sistemas.
- O problema afeta relatórios, faturamento ou auditoria.

---

## 12. Erro “500”, “502” ou “503”

### Problema
O sistema exibe erro de servidor ou página indisponível.

### Solução
1. Informe ao usuário que não é um erro de senha ou preenchimento.
2. Verifique o status dos serviços e monitoramento.
3. Consulte logs do backend, gateway, balanceador e banco de dados.
4. Identifique se o erro é geral ou restrito a um endpoint/usuário.
5. Comunique o usuário sobre previsão de retorno, se houver incidente.

| Código | Significado comum | Primeira verificação |
|---|---|---|
| 500 | Erro interno no servidor | Logs da aplicação e stack trace |
| 502 | Gateway recebeu resposta inválida | Backend, proxy e serviço upstream |
| 503 | Serviço indisponível | Capacidade, deploy, manutenção ou dependência |
| 504 | Tempo limite do gateway | Latência, banco de dados e integrações |

---

## 13. Como coletar informações para escalonamento

Inclua sempre:

- Nome do usuário e e-mail/ID.
- Empresa, tenant ou filial.
- Data e horário do erro, com fuso horário.
- Tela, módulo e ação executada.
- Mensagem de erro completa.
- Print ou gravação da tela.
- Navegador, sistema operacional e versão do app.
- ID do erro, request ID ou correlation ID.
- Passos para reproduzir.
- Impacto: quantos usuários são afetados e se há prejuízo financeiro ou operacional.

## 14. Modelo de resposta ao usuário

> Olá, [nome]!  
>  
> Recebemos seu relato e já estamos verificando. Para agilizar a análise, poderia nos enviar um print da mensagem de erro, o horário aproximado em que ocorreu e o ID do erro, se aparecer na tela?  
>  
> Enquanto isso, recomendamos atualizar a página, limpar o cache ou tentar em uma janela anônima. Assim que tivermos uma atualização, entraremos em contato.
