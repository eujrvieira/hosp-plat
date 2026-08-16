-- Farmácia Hospitalar — schema inicial
-- PostgreSQL / Supabase
-- Execute este arquivo no SQL Editor de um projeto Supabase novo.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Identidade e ensino
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  avatar_url text,
  global_status text not null default 'active' check (global_status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  term text not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_memberships (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('instructor','assistant','student')),
  status text not null default 'invited' check (status in ('invited','active','suspended','archived')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id,user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  email text not null,
  role text not null check (role in ('instructor','assistant','student')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'sent' check (status in ('sent','accepted','expired','revoked')),
  created_at timestamptz not null default now()
);

create table if not exists public.student_groups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  name text not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique(course_id,name)
);

create table if not exists public.group_members (
  group_id uuid not null references public.student_groups(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(group_id,user_id)
);

-- -----------------------------------------------------------------------------
-- 2) Casos, pacientes, episódios e dados clínicos
-- -----------------------------------------------------------------------------
create table if not exists public.case_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.simulated_patients (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  case_template_id uuid references public.case_templates(id) on delete restrict,
  code text not null,
  display_name text not null,
  age integer check (age is null or age >= 0),
  sex text,
  weight_kg numeric(7,2) check (weight_kg is null or weight_kg > 0),
  height_cm numeric(7,2) check (height_cm is null or height_cm > 0),
  baseline_summary text not null,
  outcome text check (outcome is null or outcome in ('discharge','death','transfer','continued_care','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id,code)
);

create table if not exists public.case_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  patient_id uuid not null references public.simulated_patients(id) on delete restrict,
  group_id uuid references public.student_groups(id) on delete restrict,
  student_id uuid references public.profiles(id) on delete restrict,
  current_branch_key text not null default 'main',
  state text not null default 'not_started' check (state in ('not_started','active','completed','archived')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (((group_id is not null)::int + (student_id is not null)::int) = 1)
);

create unique index if not exists case_assignments_group_unique
on public.case_assignments(course_id,patient_id,group_id)
where group_id is not null and state <> 'archived';

create unique index if not exists case_assignments_student_unique
on public.case_assignments(course_id,patient_id,student_id)
where student_id is not null and state <> 'archived';

create table if not exists public.case_episodes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.simulated_patients(id) on delete restrict,
  week_no integer not null check (week_no > 0),
  branch_key text not null default 'main',
  title text not null,
  summary text not null,
  release_at timestamptz not null,
  due_at timestamptz,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(patient_id,week_no,branch_key)
);

-- Segurança: notas do professor ficam em tabela separada. RLS não oculta colunas.
create table if not exists public.episode_teacher_notes (
  episode_id uuid primary key references public.case_episodes(id) on delete cascade,
  note text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.vital_signs (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.case_episodes(id) on delete cascade,
  measured_at timestamptz not null,
  heart_rate integer,
  respiratory_rate integer,
  systolic_bp integer,
  diastolic_bp integer,
  spo2 numeric(5,2),
  temperature_c numeric(4,1),
  pain_score integer check (pain_score is null or pain_score between 0 and 10),
  extras jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.case_episodes(id) on delete cascade,
  collected_at timestamptz not null,
  test_code text,
  test_name text not null,
  value_text text not null,
  unit text,
  reference_range text,
  flag text not null default 'normal' check (flag in ('low','normal','high','critical')),
  created_at timestamptz not null default now()
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.case_episodes(id) on delete cascade,
  prescribed_at timestamptz not null,
  prescriber text,
  status text not null default 'active' check (status in ('active','suspended','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  drug text not null,
  concentration text,
  dose text not null,
  route text not null,
  frequency text not null,
  duration text,
  indication text,
  created_at timestamptz not null default now()
);

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.case_episodes(id) on delete cascade,
  note_at timestamptz not null,
  profession text not null,
  note_type text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.clinical_events (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.case_episodes(id) on delete cascade,
  event_at timestamptz not null,
  category text not null,
  severity text not null default 'moderate' check (severity in ('low','moderate','high','critical')),
  title text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.case_episodes(id) on delete cascade,
  performed_at timestamptz not null,
  procedure text not null,
  result text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3) Produção discente
-- -----------------------------------------------------------------------------
create table if not exists public.student_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.case_assignments(id) on delete restrict,
  episode_id uuid not null references public.case_episodes(id) on delete restrict,
  version_no integer not null default 1 check (version_no > 0),
  status text not null default 'draft' check (status in ('draft','submitted','reopened','graded')),
  summary text not null default '',
  submitted_at timestamptz,
  locked_at timestamptz,
  author_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assignment_id,episode_id,version_no)
);

create table if not exists public.med_related_problems (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.student_submissions(id) on delete cascade,
  sort_order integer not null default 1,
  category text not null,
  description text not null,
  evidence text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pharm_interventions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.student_submissions(id) on delete cascade,
  problem_id uuid not null references public.med_related_problems(id) on delete cascade,
  recommendation text not null,
  priority text not null default 'moderate' check (priority in ('low','moderate','high','critical')),
  target text,
  simulated_outcome text check (simulated_outcome is null or simulated_outcome in ('accepted','partially_accepted','rejected','not_applicable')),
  created_at timestamptz not null default now()
);

create table if not exists public.monitoring_plans (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.student_submissions(id) on delete cascade,
  problem_id uuid not null references public.med_related_problems(id) on delete cascade,
  parameter text not null,
  target text,
  timeframe text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4) Avaliação
-- -----------------------------------------------------------------------------
create table if not exists public.rubrics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rubric_items (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics(id) on delete cascade,
  criterion text not null,
  max_points numeric(7,2) not null,
  weight numeric(7,4) not null default 1,
  descriptor text,
  sort_order integer not null default 1
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.student_submissions(id) on delete cascade,
  total_points numeric(7,2) not null default 0,
  graded_by uuid not null references public.profiles(id) on delete restrict,
  graded_at timestamptz not null default now()
);

create table if not exists public.score_items (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references public.scores(id) on delete cascade,
  rubric_item_id uuid not null references public.rubric_items(id) on delete restrict,
  points numeric(7,2) not null,
  comment text,
  unique(score_id,rubric_item_id)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.student_submissions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  text text not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5) Auditoria
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 6) Índices
-- -----------------------------------------------------------------------------
create index if not exists idx_memberships_user on public.course_memberships(user_id,status);
create index if not exists idx_memberships_course on public.course_memberships(course_id,status,role);
create index if not exists idx_groups_course on public.student_groups(course_id);
create index if not exists idx_group_members_user on public.group_members(user_id);
create index if not exists idx_patients_course on public.simulated_patients(course_id);
create index if not exists idx_assignments_course on public.case_assignments(course_id,state);
create index if not exists idx_assignments_patient on public.case_assignments(patient_id);
create index if not exists idx_episodes_patient_release on public.case_episodes(patient_id,release_at,week_no);
create index if not exists idx_vitals_episode on public.vital_signs(episode_id,measured_at);
create index if not exists idx_labs_episode on public.lab_results(episode_id,collected_at);
create index if not exists idx_prescriptions_episode on public.prescriptions(episode_id);
create index if not exists idx_notes_episode on public.clinical_notes(episode_id,note_at);
create index if not exists idx_events_episode on public.clinical_events(episode_id,event_at);
create index if not exists idx_submissions_assignment on public.student_submissions(assignment_id,episode_id,version_no desc);
create index if not exists idx_problems_submission on public.med_related_problems(submission_id,sort_order);
create index if not exists idx_interventions_submission on public.pharm_interventions(submission_id);
create index if not exists idx_monitoring_submission on public.monitoring_plans(submission_id);

-- -----------------------------------------------------------------------------
-- 7) Funções auxiliares e triggers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,full_name,email)
  values(new.id, nullif(new.raw_user_meta_data->>'full_name',''), lower(new.email))
  on conflict(id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

create or replace function public.add_course_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.course_memberships(course_id,user_id,role,status,joined_at)
  values(new.id,new.owner_id,'instructor','active',now())
  on conflict(course_id,user_id) do update set role='instructor',status='active',joined_at=coalesce(public.course_memberships.joined_at,now());
  return new;
end;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.has_course_role(p_course_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.course_memberships cm
    where cm.course_id=p_course_id and cm.user_id=auth.uid() and cm.status='active' and cm.role=any(p_roles)
  );
$$;

create or replace function public.is_active_course_member(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.course_memberships cm
    where cm.course_id=p_course_id and cm.user_id=auth.uid() and cm.status='active'
  );
$$;

create or replace function public.can_view_profile(p_target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_target_user = auth.uid()
  or exists(
    select 1
    from public.course_memberships me
    join public.course_memberships them on them.course_id=me.course_id
    where me.user_id=auth.uid() and me.status='active' and me.role in ('instructor','assistant')
      and them.user_id=p_target_user and them.status <> 'archived'
  );
$$;

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.group_members gm where gm.group_id=p_group_id and gm.user_id=p_user_id);
$$;

create or replace function public.course_for_group(p_group_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select course_id from public.student_groups where id=p_group_id $$;

create or replace function public.has_patient_assignment(p_patient_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.case_assignments a
    where a.patient_id=p_patient_id and a.state <> 'archived'
      and (a.student_id=p_user_id or (a.group_id is not null and exists(select 1 from public.group_members gm where gm.group_id=a.group_id and gm.user_id=p_user_id)))
  );
$$;

create or replace function public.course_for_assignment(p_assignment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select course_id from public.case_assignments where id=p_assignment_id $$;

create or replace function public.assignment_belongs_to_user(p_assignment_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.case_assignments a
    where a.id=p_assignment_id and a.state <> 'archived'
      and (
        a.student_id=p_user_id
        or (a.group_id is not null and exists(
          select 1 from public.group_members gm where gm.group_id=a.group_id and gm.user_id=p_user_id
        ))
      )
  );
$$;

create or replace function public.course_for_patient(p_patient_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select course_id from public.simulated_patients where id=p_patient_id $$;

create or replace function public.course_for_episode(p_episode_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.course_id
  from public.case_episodes e join public.simulated_patients p on p.id=e.patient_id
  where e.id=p_episode_id
$$;

create or replace function public.course_for_submission(p_submission_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.course_id
  from public.student_submissions s join public.case_assignments a on a.id=s.assignment_id
  where s.id=p_submission_id
$$;

create or replace function public.can_read_episode(p_episode_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.case_episodes e
    join public.simulated_patients p on p.id=e.patient_id
    where e.id=p_episode_id
      and (
        exists(
          select 1 from public.course_memberships cm
          where cm.course_id=p.course_id and cm.user_id=p_user_id and cm.status='active' and cm.role in ('instructor','assistant')
        )
        or (
          e.release_at <= now()
          and exists(
            select 1 from public.case_assignments a
            where a.patient_id=e.patient_id and a.course_id=p.course_id and a.state <> 'archived'
              and (e.branch_key='main' or e.branch_key=a.current_branch_key)
              and (
                a.student_id=p_user_id
                or (a.group_id is not null and exists(select 1 from public.group_members gm where gm.group_id=a.group_id and gm.user_id=p_user_id))
              )
          )
        )
      )
  );
$$;

create or replace function public.can_edit_submission(p_submission_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.student_submissions s
    where s.id=p_submission_id
      and s.status in ('draft','reopened')
      and public.assignment_belongs_to_user(s.assignment_id,p_user_id)
      and public.can_read_episode(s.episode_id,p_user_id)
  );
$$;

create or replace function public.submission_author_snapshot(p_assignment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.assignment_belongs_to_user(p_assignment_id,auth.uid())
     and not exists(
       select 1 from public.case_assignments a
       join public.course_memberships cm on cm.course_id=a.course_id
       where a.id=p_assignment_id and cm.user_id=auth.uid() and cm.status='active' and cm.role in ('instructor','assistant')
     ) then
    raise exception 'not allowed';
  end if;

  select case
    when a.student_id is not null then jsonb_build_array(jsonb_build_object('user_id',p.id,'full_name',p.full_name,'email',p.email))
    else coalesce((
      select jsonb_agg(jsonb_build_object('user_id',gp.id,'full_name',gp.full_name,'email',gp.email) order by gp.full_name)
      from public.group_members gm join public.profiles gp on gp.id=gm.user_id where gm.group_id=a.group_id
    ),'[]'::jsonb)
  end
  into result
  from public.case_assignments a
  left join public.profiles p on p.id=a.student_id
  where a.id=p_assignment_id;
  return coalesce(result,'[]'::jsonb);
end;
$$;

create or replace function public.mark_memberships_joined()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.course_memberships
  set status='active', joined_at=coalesce(joined_at,now()), updated_at=now()
  where user_id=auth.uid() and status='invited';

  update public.invitations
  set status='accepted'
  where lower(email)=lower((select email from public.profiles where id=auth.uid())) and status='sent';
end;
$$;

-- triggers

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email,raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

drop trigger if exists on_course_created on public.courses;
create trigger on_course_created
after insert on public.courses
for each row execute function public.add_course_owner_membership();

-- generic updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','courses','course_memberships','case_templates','simulated_patients','case_assignments','case_episodes','episode_teacher_notes','student_submissions','feedback']
  LOOP
    EXECUTE format('drop trigger if exists trg_%I_updated_at on public.%I',t,t);
    EXECUTE format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 8) Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.courses enable row level security;
alter table public.course_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.student_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.case_templates enable row level security;
alter table public.simulated_patients enable row level security;
alter table public.case_assignments enable row level security;
alter table public.case_episodes enable row level security;
alter table public.episode_teacher_notes enable row level security;
alter table public.vital_signs enable row level security;
alter table public.lab_results enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.clinical_events enable row level security;
alter table public.procedures enable row level security;
alter table public.student_submissions enable row level security;
alter table public.med_related_problems enable row level security;
alter table public.pharm_interventions enable row level security;
alter table public.monitoring_plans enable row level security;
alter table public.rubrics enable row level security;
alter table public.rubric_items enable row level security;
alter table public.scores enable row level security;
alter table public.score_items enable row level security;
alter table public.feedback enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (public.can_view_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

-- platform_admins: usuário só enxerga sua própria condição; service role administra.
create policy platform_admins_select_self on public.platform_admins for select to authenticated using (user_id=auth.uid());

-- courses
create policy courses_select on public.courses for select to authenticated using (public.is_active_course_member(id) or public.is_platform_admin());
create policy courses_insert on public.courses for insert to authenticated with check (public.is_platform_admin() and owner_id=auth.uid());
create policy courses_update on public.courses for update to authenticated using (public.has_course_role(id,array['instructor','assistant'])) with check (public.has_course_role(id,array['instructor','assistant']));

-- memberships
create policy memberships_select on public.course_memberships for select to authenticated using (user_id=auth.uid() or public.has_course_role(course_id,array['instructor','assistant']));
create policy memberships_insert_staff on public.course_memberships for insert to authenticated with check (public.has_course_role(course_id,array['instructor','assistant']));
create policy memberships_update_staff on public.course_memberships for update to authenticated using (public.has_course_role(course_id,array['instructor','assistant'])) with check (public.has_course_role(course_id,array['instructor','assistant']));

-- invitations
create policy invitations_staff_all on public.invitations for all to authenticated using (public.has_course_role(course_id,array['instructor','assistant'])) with check (public.has_course_role(course_id,array['instructor','assistant']));

-- groups
create policy groups_select on public.student_groups for select to authenticated using (
  public.has_course_role(course_id,array['instructor','assistant']) or public.is_group_member(id,auth.uid())
);
create policy groups_staff_all on public.student_groups for all to authenticated using (public.has_course_role(course_id,array['instructor','assistant'])) with check (public.has_course_role(course_id,array['instructor','assistant']));
create policy group_members_select on public.group_members for select to authenticated using (
  user_id=auth.uid() or public.has_course_role(public.course_for_group(group_id),array['instructor','assistant'])
);
create policy group_members_staff_all on public.group_members for all to authenticated using (
  public.has_course_role(public.course_for_group(group_id),array['instructor','assistant'])
) with check (
  public.has_course_role(public.course_for_group(group_id),array['instructor','assistant'])
);

-- templates
create policy templates_select on public.case_templates for select to authenticated using (owner_id=auth.uid() or public.is_platform_admin());
create policy templates_insert on public.case_templates for insert to authenticated with check (owner_id=auth.uid());
create policy templates_update on public.case_templates for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());

-- patients
create policy patients_select on public.simulated_patients for select to authenticated using (
  public.has_course_role(course_id,array['instructor','assistant']) or public.has_patient_assignment(id,auth.uid())
);
create policy patients_staff_all on public.simulated_patients for all to authenticated using (public.has_course_role(course_id,array['instructor','assistant'])) with check (public.has_course_role(course_id,array['instructor','assistant']));

-- assignments
create policy assignments_select on public.case_assignments for select to authenticated using (public.has_course_role(course_id,array['instructor','assistant']) or public.assignment_belongs_to_user(id,auth.uid()));
create policy assignments_staff_all on public.case_assignments for all to authenticated using (public.has_course_role(course_id,array['instructor','assistant'])) with check (public.has_course_role(course_id,array['instructor','assistant']));

-- episodes
create policy episodes_select on public.case_episodes for select to authenticated using (public.can_read_episode(id,auth.uid()));
create policy episodes_insert_staff on public.case_episodes for insert to authenticated with check (public.has_course_role(public.course_for_patient(patient_id),array['instructor','assistant']));
create policy episodes_update_staff on public.case_episodes for update to authenticated using (public.has_course_role(public.course_for_patient(patient_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_patient(patient_id),array['instructor','assistant']));
create policy episodes_delete_staff on public.case_episodes for delete to authenticated using (public.has_course_role(public.course_for_patient(patient_id),array['instructor','assistant']));

-- teacher notes: nunca há policy para aluno.
create policy teacher_notes_staff_all on public.episode_teacher_notes for all to authenticated using (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant']));

-- clinical child tables
create policy vitals_select on public.vital_signs for select to authenticated using (public.can_read_episode(episode_id,auth.uid()));
create policy vitals_staff_all on public.vital_signs for all to authenticated using (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant']));
create policy labs_select on public.lab_results for select to authenticated using (public.can_read_episode(episode_id,auth.uid()));
create policy labs_staff_all on public.lab_results for all to authenticated using (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant']));
create policy prescriptions_select on public.prescriptions for select to authenticated using (public.can_read_episode(episode_id,auth.uid()));
create policy prescriptions_staff_all on public.prescriptions for all to authenticated using (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant']));
create policy prescription_items_select on public.prescription_items for select to authenticated using (exists(select 1 from public.prescriptions p where p.id=prescription_id and public.can_read_episode(p.episode_id,auth.uid())));
create policy prescription_items_staff_all on public.prescription_items for all to authenticated using (exists(select 1 from public.prescriptions p where p.id=prescription_id and public.has_course_role(public.course_for_episode(p.episode_id),array['instructor','assistant']))) with check (exists(select 1 from public.prescriptions p where p.id=prescription_id and public.has_course_role(public.course_for_episode(p.episode_id),array['instructor','assistant'])));
create policy clinical_notes_select on public.clinical_notes for select to authenticated using (public.can_read_episode(episode_id,auth.uid()));
create policy clinical_notes_staff_all on public.clinical_notes for all to authenticated using (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant']));
create policy clinical_events_select on public.clinical_events for select to authenticated using (public.can_read_episode(episode_id,auth.uid()));
create policy clinical_events_staff_all on public.clinical_events for all to authenticated using (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant']));
create policy procedures_select on public.procedures for select to authenticated using (public.can_read_episode(episode_id,auth.uid()));
create policy procedures_staff_all on public.procedures for all to authenticated using (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_episode(episode_id),array['instructor','assistant']));

-- submissions
create policy submissions_select on public.student_submissions for select to authenticated using (
  public.assignment_belongs_to_user(assignment_id,auth.uid())
  or public.has_course_role(public.course_for_assignment(assignment_id),array['instructor','assistant'])
);
create policy submissions_insert_student on public.student_submissions for insert to authenticated with check (
  public.assignment_belongs_to_user(assignment_id,auth.uid()) and public.can_read_episode(episode_id,auth.uid()) and status='draft'
);
create policy submissions_update_student on public.student_submissions for update to authenticated using (
  public.assignment_belongs_to_user(assignment_id,auth.uid()) and status in ('draft','reopened')
) with check (
  public.assignment_belongs_to_user(assignment_id,auth.uid()) and status in ('draft','reopened','submitted')
);
create policy submissions_staff_update on public.student_submissions for update to authenticated using (public.has_course_role(public.course_for_assignment(assignment_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_assignment(assignment_id),array['instructor','assistant']));

-- submission children
create policy problems_select on public.med_related_problems for select to authenticated using (exists(select 1 from public.student_submissions s where s.id=submission_id and (public.assignment_belongs_to_user(s.assignment_id,auth.uid()) or public.has_course_role(public.course_for_submission(s.id),array['instructor','assistant']))));
create policy problems_student_all on public.med_related_problems for all to authenticated using (public.can_edit_submission(submission_id,auth.uid())) with check (public.can_edit_submission(submission_id,auth.uid()));
create policy problems_staff_all on public.med_related_problems for all to authenticated using (public.has_course_role(public.course_for_submission(submission_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_submission(submission_id),array['instructor','assistant']));
create policy interventions_select on public.pharm_interventions for select to authenticated using (exists(select 1 from public.student_submissions s where s.id=submission_id and (public.assignment_belongs_to_user(s.assignment_id,auth.uid()) or public.has_course_role(public.course_for_submission(s.id),array['instructor','assistant']))));
create policy interventions_student_all on public.pharm_interventions for all to authenticated using (public.can_edit_submission(submission_id,auth.uid())) with check (public.can_edit_submission(submission_id,auth.uid()));
create policy interventions_staff_all on public.pharm_interventions for all to authenticated using (public.has_course_role(public.course_for_submission(submission_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_submission(submission_id),array['instructor','assistant']));
create policy monitoring_select on public.monitoring_plans for select to authenticated using (exists(select 1 from public.student_submissions s where s.id=submission_id and (public.assignment_belongs_to_user(s.assignment_id,auth.uid()) or public.has_course_role(public.course_for_submission(s.id),array['instructor','assistant']))));
create policy monitoring_student_all on public.monitoring_plans for all to authenticated using (public.can_edit_submission(submission_id,auth.uid())) with check (public.can_edit_submission(submission_id,auth.uid()));
create policy monitoring_staff_all on public.monitoring_plans for all to authenticated using (public.has_course_role(public.course_for_submission(submission_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_submission(submission_id),array['instructor','assistant']));

-- rubrics / grades
create policy rubrics_staff_all on public.rubrics for all to authenticated using (public.has_course_role(course_id,array['instructor','assistant'])) with check (public.has_course_role(course_id,array['instructor','assistant']));
create policy rubric_items_staff_all on public.rubric_items for all to authenticated using (exists(select 1 from public.rubrics r where r.id=rubric_id and public.has_course_role(r.course_id,array['instructor','assistant']))) with check (exists(select 1 from public.rubrics r where r.id=rubric_id and public.has_course_role(r.course_id,array['instructor','assistant'])));
create policy scores_staff_all on public.scores for all to authenticated using (public.has_course_role(public.course_for_submission(submission_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_submission(submission_id),array['instructor','assistant']));
create policy scores_student_select on public.scores for select to authenticated using (
  exists(select 1 from public.student_submissions s where s.id=submission_id and public.assignment_belongs_to_user(s.assignment_id,auth.uid()))
  and exists(select 1 from public.feedback f where f.submission_id=submission_id and f.released_at is not null and f.released_at <= now())
);
create policy score_items_staff_all on public.score_items for all to authenticated using (exists(select 1 from public.scores s where s.id=score_id and public.has_course_role(public.course_for_submission(s.submission_id),array['instructor','assistant']))) with check (exists(select 1 from public.scores s where s.id=score_id and public.has_course_role(public.course_for_submission(s.submission_id),array['instructor','assistant'])));
create policy score_items_student_select on public.score_items for select to authenticated using (exists(select 1 from public.scores sc join public.student_submissions s on s.id=sc.submission_id join public.feedback f on f.submission_id=s.id where sc.id=score_id and public.assignment_belongs_to_user(s.assignment_id,auth.uid()) and f.released_at is not null and f.released_at <= now()));
create policy feedback_staff_all on public.feedback for all to authenticated using (public.has_course_role(public.course_for_submission(submission_id),array['instructor','assistant'])) with check (public.has_course_role(public.course_for_submission(submission_id),array['instructor','assistant']));
create policy feedback_student_select on public.feedback for select to authenticated using (
  released_at is not null and released_at <= now()
  and exists(select 1 from public.student_submissions s where s.id=submission_id and public.assignment_belongs_to_user(s.assignment_id,auth.uid()))
);

-- audit logs: somente equipe da turma / admin lê; escrita preferencialmente via backend service role.
create policy audit_logs_select on public.audit_logs for select to authenticated using (public.is_platform_admin() or (course_id is not null and public.has_course_role(course_id,array['instructor','assistant'])));

-- -----------------------------------------------------------------------------
-- 9) Privilégios de funções expostas
-- -----------------------------------------------------------------------------
revoke all on function public.is_platform_admin() from public;
revoke all on function public.has_course_role(uuid,text[]) from public;
revoke all on function public.is_active_course_member(uuid) from public;
revoke all on function public.can_view_profile(uuid) from public;
revoke all on function public.is_group_member(uuid,uuid) from public;
revoke all on function public.has_patient_assignment(uuid,uuid) from public;
revoke all on function public.assignment_belongs_to_user(uuid,uuid) from public;
revoke all on function public.can_read_episode(uuid,uuid) from public;
revoke all on function public.can_edit_submission(uuid,uuid) from public;
revoke all on function public.submission_author_snapshot(uuid) from public;
revoke all on function public.mark_memberships_joined() from public;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.has_course_role(uuid,text[]) to authenticated;
grant execute on function public.is_active_course_member(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.is_group_member(uuid,uuid) to authenticated;
grant execute on function public.has_patient_assignment(uuid,uuid) to authenticated;
grant execute on function public.assignment_belongs_to_user(uuid,uuid) to authenticated;
grant execute on function public.can_read_episode(uuid,uuid) to authenticated;
grant execute on function public.can_edit_submission(uuid,uuid) to authenticated;
grant execute on function public.submission_author_snapshot(uuid) to authenticated;
grant execute on function public.mark_memberships_joined() to authenticated;

-- FIM
