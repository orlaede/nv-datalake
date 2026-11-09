with base as (
    select
        source_key,
        id,
        codigo_retorno,
        descricao,
        retorno_sucesso
    from {{ ref('stg_codigo_retorno') }}
)

select
    row_number() over (order by source_key, id) as sk_codigo_retorno,
    source_key,
    id,
    codigo_retorno,
    descricao,
    retorno_sucesso
from base

union all

select
    0 as sk_codigo_retorno,
    null as source_key,
    0 as id,
    null as codigo_retorno,
    'Não Informado' as descricao,
    null as retorno_sucesso
