with base as (
    -- codigo is the IBGE code: it's the same real-world city regardless of
    -- which source schema it came from, so dedupe by codigo instead of
    -- keying by (source_key, codigo) like the other dimensions.
    select
        min(source_key) as source_key,
        codigo,
        descricao,
        uf_id,
        version
    from {{ ref('stg_municipio') }}
    group by codigo, descricao, uf_id, version
)

select
    row_number() over (order by codigo) as sk_municipio,
    source_key,
    codigo,
    descricao,
    uf_id,
    version
from base

union all

select
    0 as sk_municipio,
    null as source_key,
    0 as codigo,
    'Não Informado' as descricao,
    null as uf_id,
    null as version
