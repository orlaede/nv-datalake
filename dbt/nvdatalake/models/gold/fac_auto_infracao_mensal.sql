select
    date_trunc('month', data_hora) as mes,
    sk_infracao,
    sk_agente,
    medicao_id,
    count(*) as total_autos
from {{ ref('fac_auto_infracao') }}
group by 1, 2, 3, 4
