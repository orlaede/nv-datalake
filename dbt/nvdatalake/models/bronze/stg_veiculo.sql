select *, 'nvtr_ce_caucaia_amostra' as source_key
from {{ source('bronze', 'nvtr_ce_caucaia_amostra__veiculo') }}
union all
select *, 'nvtr_ce_quixada' as source_key
from {{ source('bronze', 'nvtr_ce_quixada__veiculo') }}
