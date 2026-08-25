select *, 'nvtr_ce_eusebio' as source_key
from {{ source('bronze', 'nvtr_ce_eusebio__agente') }}
union all
select *, 'nvtr_ce_aquiraz' as source_key
from {{ source('bronze', 'nvtr_ce_aquiraz__agente') }}
