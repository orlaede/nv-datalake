with base as (
    select
        source_key,
        id,
        descricao,
        enquadramento,
        obs_sugerida,
        pontos_cnh,
        tipo_infrator,
        tipo_medicao,
        competencia,
        version,
        codigo,
        vigencia_inicio,
        vigencia_fim,
        abordagem,
        orientacao_fiscalizacao
    from {{ ref('stg_infracao') }}
)

select
    row_number() over (order by source_key, id) as sk_infracao,
    source_key,
    id,
    descricao,
    enquadramento,
    obs_sugerida,
    pontos_cnh,
    tipo_infrator,
    tipo_medicao,
    competencia,
    version,
    codigo,
    vigencia_inicio,
    vigencia_fim,
    abordagem,
    orientacao_fiscalizacao
from base

union all

select
    0 as sk_infracao,
    null as source_key,
    0 as id,
    'Não Informado' as descricao,
    null as enquadramento,
    null as obs_sugerida,
    null as pontos_cnh,
    null as tipo_infrator,
    null as tipo_medicao,
    null as competencia,
    null as version,
    null as codigo,
    null as vigencia_inicio,
    null as vigencia_fim,
    null as abordagem,
    null as orientacao_fiscalizacao
