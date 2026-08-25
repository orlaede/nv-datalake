with base as (
    select
        source_key,
        id,
        descricao
    from {{ ref('stg_erro_consistencia') }}
)

select
    row_number() over (order by source_key, id) as sk_erro_consistencia,
    source_key,
    id,
    descricao
from base

union all

select
    0 as sk_erro_consistencia,
    null as source_key,
    0 as id,
    'Não Informado' as descricao
