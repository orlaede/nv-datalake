select
    id, descricao, enquadramento, obs_sugerida, pontos_cnh, tipo_infrator, tipo_medicao,
    competencia, version, codigo, vigencia_inicio, vigencia_fim, abordagem,
    orientacao_fiscalizacao,
    'nvtr_ce_caucaia_amostra' as source_key
from {{ source('bronze', 'nvtr_ce_caucaia_amostra__infracao') }}
union all
select
    id, descricao, enquadramento, obs_sugerida, pontos_cnh, tipo_infrator, tipo_medicao,
    competencia, version, codigo, vigencia_inicio, vigencia_fim, abordagem,
    null as orientacao_fiscalizacao,
    'nvtr_ce_quixada' as source_key
from {{ source('bronze', 'nvtr_ce_quixada__infracao') }}
