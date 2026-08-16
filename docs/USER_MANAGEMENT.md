# Gestão de usuários

## Quem controla a senha

O Supabase Auth. A aplicação nunca recebe, lista ou armazena a senha de alunos e professores.

## Fluxo de convite

1. Professor abre **Usuários e grupos**.
2. Informa nome, e-mail e função naquela turma.
3. O backend verifica `profiles`.
4. Se a conta já existe, cria/reativa `course_memberships` sem recriar usuário.
5. Se não existe, usa `SUPABASE_SERVICE_ROLE_KEY` no servidor para chamar `inviteUserByEmail`.
6. O trigger do Auth cria `profiles` com o mesmo UUID de `auth.users`.
7. A matrícula fica `invited` até o primeiro acesso.
8. No login/callback, `mark_memberships_joined()` altera a matrícula para `active` e registra `joined_at`.

## O que o professor consegue fazer

- convidar aluno, colaborador ou professor;
- vincular uma conta já existente;
- suspender acesso à turma sem apagar a conta;
- reativar acesso;
- arquivar matrícula;
- criar grupos;
- adicionar/remover alunos dos grupos;
- atribuir paciente a grupo ou aluno individual;
- alterar o ramo clínico de uma atribuição.

## O que o professor não deve fazer

- criar senhas iguais para a turma;
- guardar senha em planilha;
- compartilhar uma conta por grupo;
- apagar `auth.users` ao final do semestre;
- usar e-mail como chave relacional principal.

## Service role

`SUPABASE_SERVICE_ROLE_KEY` ignora RLS. Por isso ela aparece somente em código de servidor (`lib/supabase/admin.ts`) e nunca pode começar com `NEXT_PUBLIC_`.

Antes de qualquer ação administrativa com service role, o código valida a sessão normal e confirma que o usuário é professor/assistente ativo da turma.
