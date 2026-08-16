# Plataforma Educacional de Farmácia Hospitalar

MVP funcional para acompanhamento longitudinal de pacientes simulados em uma disciplina de Farmácia Hospitalar.

## O que já está implementado

- autenticação por e-mail/senha e link mágico;
- painel com visão docente e discente;
- turmas e papéis contextuais por turma;
- convite e gestão de usuários;
- suspensão/reativação/arquivamento de matrícula;
- grupos de alunos;
- criação de paciente fictício;
- episódios semanais com liberação programada e prazo;
- ramificação básica por `branch_key`;
- sinais vitais, exames, prescrições, evoluções e intercorrências;
- atribuição de caso a grupo ou aluno individual;
- prontuário do aluno com apenas episódios liberados;
- avaliação farmacêutica estruturada em PRM, intervenção e monitoramento;
- rascunho, envio, bloqueio, reabertura, nota e feedback;
- Row Level Security no PostgreSQL;
- notas exclusivas do professor em tabela isolada;
- dados de demonstração opcionais.

## Stack

- Next.js + TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Row Level Security (RLS)
- Vercel para hospedagem recomendada

## Estrutura

```text
app/
  dashboard/                  painel geral
  login/                      autenticação
  professor/courses/...       gestão docente
  student/assignments/...     prontuário e submissões
components/                   componentes de interface
lib/supabase/                 clientes Supabase browser/server/admin
supabase/schema.sql            banco completo + funções + RLS
scripts/bootstrap-admin.mjs   habilita a primeira conta a criar turmas
scripts/seed-demo.mjs         cria professor/aluno/caso demonstrativo
docs/DATABASE.md              explicação do modelo de dados
docs/USER_MANAGEMENT.md       fluxo de gestão de usuários
```

## 1. Criar o projeto Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Execute todo o arquivo `supabase/schema.sql`.
4. Em **Authentication > URL Configuration**, adicione:
   - `http://localhost:3000/auth/callback`
   - depois, a URL de produção: `https://SEU-SITE.vercel.app/auth/callback`
5. Em **Authentication > Providers**, mantenha e-mail habilitado.

> Para produção, configure SMTP próprio no Supabase. O envio de convites depende de e-mail transacional confiável.

## 2. Variáveis de ambiente

Copie:

```bash
cp .env.example .env.local
```

Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Regra crítica

`SUPABASE_SERVICE_ROLE_KEY` nunca vai para código client-side, GitHub público ou variável `NEXT_PUBLIC_*`. Ela ignora RLS.

## 3. Instalar e executar

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## 4. Criar sua primeira conta de professora

Como o sistema não possui cadastro público aberto, faça o bootstrap de uma conta administrativa:

1. No Supabase, abra **Authentication > Users**.
2. Crie sua conta com seu e-mail e confirme o usuário.
3. O trigger do banco criará `profiles` automaticamente.
4. No terminal, com `.env.local` carregado no ambiente, execute:

```bash
node --env-file=.env.local scripts/bootstrap-admin.mjs seu-email@dominio.com
```

5. Entre no site. A opção **Criar nova turma** aparecerá.

`platform_admins` serve apenas para permitir criação de turmas. Depois que a turma existe, permissões são definidas em `course_memberships`.

## 5. Como você gerencia os usuários

Na turma, abra **Usuários e grupos**.

### Convidar

Informe nome, e-mail e função. O servidor faz duas rotas:

- **conta já existe:** não cria outra conta; apenas vincula o UUID existente à turma;
- **conta não existe:** o Supabase Auth envia convite e cria o usuário.

O professor não define nem conhece a senha do aluno.

### Suspender

Suspender muda apenas o vínculo daquela turma para `suspended`. A pessoa continua com a conta, mas perde acesso aos dados da turma por RLS.

### Arquivar

Use quando a pessoa saiu da turma ou o semestre terminou. O histórico acadêmico permanece no banco.

### Grupos

Grupos são separados das contas. Isso permite trocar a composição sem alterar usuário, login ou histórico.

Leia `docs/USER_MANAGEMENT.md` para o fluxo completo.

## 6. Como o banco funciona

A relação central é:

```text
Turma
 ├─ Matrículas (professor / colaborador / aluno)
 ├─ Grupos
 └─ Pacientes simulados
      └─ Atribuições para grupo/aluno
           └─ Episódios semanais
                ├─ Sinais vitais
                ├─ Exames
                ├─ Prescrições
                ├─ Evoluções
                ├─ Eventos
                └─ Submissão do aluno
                     ├─ PRMs
                     ├─ Intervenções
                     ├─ Monitoramento
                     └─ Nota + feedback
```

A submissão não substitui a anterior quando novas semanas são liberadas. Cada episódio mantém o seu próprio raciocínio clínico.

### Episódios futuros

O registro pode existir no banco antes da aula. RLS só permite leitura do aluno quando `release_at <= now()` e o episódio pertence ao ramo permitido da atribuição.

### Conteúdo exclusivo do professor

Notas ocultas não ficam em `case_episodes`. Elas ficam em `episode_teacher_notes`, que não possui política de leitura para aluno.

Leia `docs/DATABASE.md`.

## 7. Teste rápido com dados de demonstração

Opcional:

```bash
node --env-file=.env.local scripts/seed-demo.mjs
```

Por padrão cria:

- `professor.demo@example.com`
- `aluno.demo@example.com`
- senha: `Troque-Esta-Senha-123!`

Altere as variáveis `DEMO_TEACHER_EMAIL`, `DEMO_STUDENT_EMAIL` e `DEMO_PASSWORD` antes de usar fora de ambiente local.

## 8. Publicar na Vercel

1. Envie este diretório para um repositório Git.
2. Importe o repositório na Vercel.
3. Cadastre as quatro variáveis de ambiente.
4. Troque `NEXT_PUBLIC_SITE_URL` para a URL publicada.
5. Adicione essa URL às Redirect URLs do Supabase Auth.
6. Faça o deploy.

O frontend e o backend web ficam na Vercel. Banco, autenticação e políticas ficam no Supabase.

## 9. Checklist antes de usar com uma turma real

- testar login como professor e aluno;
- verificar que aluno não abre caso de outro grupo;
- verificar que episódio futuro retorna vazio/sem acesso;
- verificar que `episode_teacher_notes` não aparece para aluno;
- testar submissão e bloqueio depois do envio;
- testar reabertura pelo professor;
- testar suspensão de matrícula;
- configurar SMTP e domínio de produção;
- usar somente pacientes fictícios;
- definir política institucional de retenção de dados acadêmicos;
- exportar notas antes de arquivar a turma.

## Limitações conscientes do MVP

- editor clínico prioriza entrada manual; importação CSV ainda não está implementada;
- rubrica detalhada por critério existe no schema, mas a interface atual usa nota total + feedback;
- anexos/Storage ainda não têm interface;
- analytics docente avançado ainda não está implementado;
- ramificação é manual pelo professor (`current_branch_key`), sem motor automático de regras;
- não há integração com o sistema acadêmico institucional.

Essas limitações foram deixadas fora do primeiro recorte para não transformar o piloto em um sistema hospitalar completo antes de validar o fluxo pedagógico.


13022005@BlMpsv