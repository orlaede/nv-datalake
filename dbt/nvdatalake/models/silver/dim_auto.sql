-- Business key: source_key + num_auto (num_auto com trim). Linha 0 = auto desconhecido.
with base as (
    select
        source_key,
        nullif(trim(num_auto), '') as num_auto
    from {{ ref('stg_auto_infracao') }}
)

select
    row_number() over (order by source_key, num_auto) as sk_auto,
    source_key,
    num_auto
from base
where num_auto is not null

union all

select
    0 as sk_auto,
    null as source_key,
    'Não Informado' as num_auto
