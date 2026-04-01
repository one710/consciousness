-- pgvector (usually already enabled on Supabase projects)
create extension if not exists vector;

-- One place to set embedding width (must match EmbeddingProvider.getDimensions()).
-- Change only `embedding_dim` before the first apply. If you already ran this migration
-- with another size, drop `consciousness_memory` and the function or add a new migration
-- to ALTER COLUMN / replace the function.

do $body$
declare
  embedding_dim int := 384;
begin
  execute format($sql$
    create table if not exists public.consciousness_memory (
      id text primary key,
      session_id text not null,
      content text not null,
      embedding vector(%s) not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  $sql$, embedding_dim);

  execute $sql$
    create index if not exists consciousness_memory_session_id_idx
      on public.consciousness_memory (session_id);
  $sql$;

  -- IVFFlat needs enough rows to train; for small datasets consider skipping or using HNSW if available.
  execute $sql$
    create index if not exists consciousness_memory_embedding_ivfflat_idx
      on public.consciousness_memory
      using ivfflat (embedding vector_cosine_ops)
      with (lists = 100);
  $sql$;

  execute format($fn$
    create or replace function public.consciousness_memory_search(
      p_query_embedding vector(%s),
      p_session_id text,
      p_match_count int,
      p_metric text default 'cosine'
    )
    returns table (
      id text,
      session_id text,
      content text,
      metadata jsonb,
      score double precision,
      embedding vector(%s)
    )
    language plpgsql
    stable
    as $func$
    begin
      if p_metric = 'euclidean' then
        return query
        select
          m.id,
          m.session_id,
          m.content,
          coalesce(m.metadata, '{}'::jsonb),
          (m.embedding <-> p_query_embedding)::double precision,
          m.embedding
        from public.consciousness_memory m
        where m.session_id = p_session_id
        order by m.embedding <-> p_query_embedding
        limit greatest(p_match_count, 1);
      else
        return query
        select
          m.id,
          m.session_id,
          m.content,
          coalesce(m.metadata, '{}'::jsonb),
          (1 - (m.embedding <=> p_query_embedding))::double precision,
          m.embedding
        from public.consciousness_memory m
        where m.session_id = p_session_id
        order by m.embedding <=> p_query_embedding
        limit greatest(p_match_count, 1);
      end if;
    end;
    $func$;
  $fn$, embedding_dim, embedding_dim);

  execute format(
    'grant execute on function public.consciousness_memory_search(vector(%s), text, int, text) to authenticated, anon, service_role',
    embedding_dim
  );
end;
$body$;
