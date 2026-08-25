with base as (
    select
        source_key,
        id,
        matricula,
        nome,
        nome_guerra,
        lotacao_id,
        usuario_id,
        convenio_id
    from {{ ref('stg_agente') }}
)

select
    row_number() over (order by source_key, id) as sk_agente,
    source_key,
    id,
    matricula,
    nome,
    nome_guerra,
    lotacao_id,
    usuario_id,
    convenio_id
from base

union all

select
    0 as sk_agente,
    null as source_key,
    0 as id,
    'Não Informado' as matricula,
    'Não Informado' as nome,
    null as nome_guerra,
    null as lotacao_id,
    null as usuario_id,
    null as convenio_id
