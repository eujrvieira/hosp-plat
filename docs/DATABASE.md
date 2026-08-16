# Banco de dados

## Modelo mental

O banco não trata o caso clínico como um texto único. Ele separa os objetos para preservar histórico e permitir avaliação estruturada:

`courses → course_memberships → student_groups → case_assignments → simulated_patients → case_episodes → clinical_* → student_submissions → problems/interventions/monitoring → scores/feedback`

### Identidade

`auth.users` pertence ao Supabase Auth e guarda a identidade de login. `profiles` usa o mesmo UUID e contém apenas dados necessários à aplicação. Senha não entra em nenhuma tabela pública.

### Turmas e permissões

`course_memberships` define a função **na turma** (`instructor`, `assistant`, `student`). O papel não fica preso ao perfil global: a mesma conta pode ter funções diferentes em turmas distintas.

`platform_admins` é uma capacidade adicional e pequena: permite criar novas turmas. Não substitui a autorização contextual por turma.

### Casos e progressão

`simulated_patients` guarda os dados basais do paciente fictício. `case_episodes` representa cada semana. `release_at` controla a liberação. `branch_key` permite caminhos diferentes de evolução.

`case_assignments` é o elo entre paciente e grupo/aluno. O campo `current_branch_key` determina qual ramo o estudante acompanha.

### Notas ocultas

`episode_teacher_notes` é uma tabela separada. Isso é intencional: RLS protege **linhas**, não campos isolados. Se uma nota secreta estivesse em `case_episodes`, um estudante tecnicamente poderia tentar requisitar aquela coluna. A tabela separada possui política somente docente.

### Produção do aluno

`student_submissions` guarda a entrega por episódio. O conteúdo clínico é decomposto em `med_related_problems`, `pharm_interventions` e `monitoring_plans`. Isso permite avaliar raciocínio, e não apenas uma resposta livre.

Ao enviar, a submissão passa a `submitted` e fica bloqueada. O professor pode reabrir, corrigir e liberar feedback.

## Row Level Security

O arquivo `supabase/schema.sql` ativa RLS em todas as tabelas relevantes. As regras centrais são:

- aluno vê apenas atribuições próprias ou do próprio grupo;
- aluno vê somente episódios liberados (`release_at <= now()`), do ramo permitido;
- dados clínicos herdam a autorização do episódio;
- notas do professor são exclusivas da equipe docente;
- rascunhos só podem ser editados pelo grupo/aluno proprietário;
- submissões enviadas não podem ser alteradas pelo aluno até reabertura;
- notas e feedback só aparecem ao aluno quando `feedback.released_at` estiver liberado;
- professor/assistente acessa apenas turmas em que tenha vínculo ativo.

## Exclusão e histórico

Entidades acadêmicas importantes usam estados como `archived` em vez de exclusão destrutiva. Isso reduz o risco de apagar notas, entregas e rastreabilidade do semestre.

## Horários

Todos os timestamps ficam em UTC no banco. A interface converte para `America/Maceio` apenas na exibição.
