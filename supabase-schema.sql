-- ============================================================================
-- OPOSITIA DATABASE SCHEMA
-- ============================================================================

-- Habilitar extensiones necesarias
create extension if not exists "uuid-ossp";

-- ============================================================================
-- TABLA: users (extendida de auth.users)
-- ============================================================================
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  name text,
  oposicion text,
  subscription text default 'free',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_login timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Seguridad: solo el usuario puede ver/editar su propia información
alter table public.users enable row level security;

create policy "Users can view own data" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own data" on public.users
  for update using (auth.uid() = id);

-- Trigger para crear usuario en public.users cuando se registra en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name, oposicion)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'oposicion', 'Sin especificar')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- TABLA: themes
-- ============================================================================
create table public.themes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  number integer not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Constraint: cada usuario tiene números únicos de tema
  constraint unique_theme_number unique (user_id, number)
);

-- Seguridad RLS
alter table public.themes enable row level security;

create policy "Users can view own themes" on public.themes
  for select using (auth.uid() = user_id);

create policy "Users can insert own themes" on public.themes
  for insert with check (auth.uid() = user_id);

create policy "Users can update own themes" on public.themes
  for update using (auth.uid() = user_id);

create policy "Users can delete own themes" on public.themes
  for delete using (auth.uid() = user_id);

-- Índice para búsquedas rápidas
create index themes_user_id_idx on public.themes(user_id);

-- ============================================================================
-- TABLA: documents
-- ============================================================================
create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  theme_id uuid references public.themes(id) on delete cascade not null,
  type text not null, -- 'url', 'pdf', 'text', 'ai-search'
  content text,
  file_name text,
  processed_content text,
  search_results jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seguridad RLS
alter table public.documents enable row level security;

create policy "Users can view own documents" on public.documents
  for select using (
    exists (
      select 1 from public.themes
      where themes.id = documents.theme_id
      and themes.user_id = auth.uid()
    )
  );

create policy "Users can insert own documents" on public.documents
  for insert with check (
    exists (
      select 1 from public.themes
      where themes.id = documents.theme_id
      and themes.user_id = auth.uid()
    )
  );

create policy "Users can delete own documents" on public.documents
  for delete using (
    exists (
      select 1 from public.themes
      where themes.id = documents.theme_id
      and themes.user_id = auth.uid()
    )
  );

-- Índice
create index documents_theme_id_idx on public.documents(theme_id);

-- ============================================================================
-- TABLA: questions
-- ============================================================================
create table public.questions (
  id uuid default uuid_generate_v4() primary key,
  theme_id uuid references public.themes(id) on delete cascade not null,
  text text not null,
  options jsonb not null, -- ['opción 1', 'opción 2', 'opción 3', 'opción 4']
  correct_answer integer not null,
  difficulty text default 'media',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Validaciones
  constraint valid_correct_answer check (correct_answer >= 0 and correct_answer <= 3),
  constraint valid_difficulty check (difficulty in ('facil', 'media', 'dificil'))
);

-- Seguridad RLS
alter table public.questions enable row level security;

create policy "Users can view own questions" on public.questions
  for select using (
    exists (
      select 1 from public.themes
      where themes.id = questions.theme_id
      and themes.user_id = auth.uid()
    )
  );

create policy "Users can insert own questions" on public.questions
  for insert with check (
    exists (
      select 1 from public.themes
      where themes.id = questions.theme_id
      and themes.user_id = auth.uid()
    )
  );

create policy "Users can delete own questions" on public.questions
  for delete using (
    exists (
      select 1 from public.themes
      where themes.id = questions.theme_id
      and themes.user_id = auth.uid()
    )
  );

-- Índice
create index questions_theme_id_idx on public.questions(theme_id);

-- ============================================================================
-- TABLA: exam_history
-- ============================================================================
create table public.exam_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  config jsonb not null, -- { numQuestions, selectedThemes, penaltySystem, ... }
  score jsonb not null, -- { correct, incorrect, blank, percentage, ... }
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seguridad RLS
alter table public.exam_history enable row level security;

create policy "Users can view own exam history" on public.exam_history
  for select using (auth.uid() = user_id);

create policy "Users can insert own exam results" on public.exam_history
  for insert with check (auth.uid() = user_id);

-- Índice
create index exam_history_user_id_idx on public.exam_history(user_id);
create index exam_history_created_at_idx on public.exam_history(created_at desc);

-- ============================================================================
-- TABLA: public_content (para feature futura de compartir contenido)
-- ============================================================================
create table public.public_content (
  id uuid default uuid_generate_v4() primary key,
  original_user_id uuid references public.users(id) on delete set null,
  type text not null, -- 'question', 'document', 'theme'
  data jsonb not null,
  verified boolean default false,
  verified_by uuid references public.users(id),
  quality_score decimal,
  usage_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seguridad RLS (todos pueden leer contenido público verificado)
alter table public.public_content enable row level security;

create policy "Anyone can view verified public content" on public.public_content
  for select using (verified = true);

create policy "Users can submit content for review" on public.public_content
  for insert with check (auth.uid() = original_user_id);

-- Índices
create index public_content_type_idx on public.public_content(type);
create index public_content_verified_idx on public.public_content(verified);

-- ============================================================================
-- FUNCIONES ÚTILES
-- ============================================================================

-- Función para obtener estadísticas del usuario
create or replace function get_user_stats(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_stats jsonb;
begin
  select jsonb_build_object(
    'total_themes', count(distinct t.id),
    'total_questions', count(distinct q.id),
    'total_documents', count(distinct d.id),
    'total_exams', count(distinct e.id),
    'avg_exam_score', avg((e.score->>'percentage')::numeric)
  )
  into v_stats
  from public.themes t
  left join public.questions q on q.theme_id = t.id
  left join public.documents d on d.theme_id = t.id
  left join public.exam_history e on e.user_id = t.user_id
  where t.user_id = p_user_id;
  
  return v_stats;
end;
$$;

-- ============================================================================
-- VISTA: user_dashboard (estadísticas rápidas)
-- ============================================================================
create or replace view user_dashboard as
select
  u.id as user_id,
  u.email,
  u.name,
  u.oposicion,
  u.subscription,
  count(distinct t.id) as total_themes,
  count(distinct q.id) as total_questions,
  count(distinct d.id) as total_documents,
  count(distinct e.id) as total_exams,
  avg((e.score->>'percentage')::numeric) as avg_exam_score
from public.users u
left join public.themes t on t.user_id = u.id
left join public.questions q on q.theme_id = t.id
left join public.documents d on d.theme_id = t.id
left join public.exam_history e on e.user_id = u.id
group by u.id, u.email, u.name, u.oposicion, u.subscription;

-- ============================================================================
-- COMENTARIOS EN LAS TABLAS
-- ============================================================================
comment on table public.users is 'Extended user profiles linked to auth.users';
comment on table public.themes is 'Study themes created by users';
comment on table public.documents is 'Documents/resources for each theme';
comment on table public.questions is 'Generated or manual questions for themes';
comment on table public.exam_history is 'Record of completed exams and scores';
comment on table public.public_content is 'User-contributed content for sharing (future feature)';

-- ============================================================================
-- FIN DEL SCHEMA
-- ============================================================================
