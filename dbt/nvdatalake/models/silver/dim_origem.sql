with origens as (
    select distinct source_key
    from {{ ref('stg_auto_infracao') }}
)

select
    row_number() over (order by source_key) as sk_origem,
    source_key,
    case source_key
        when 'nvtr_ce_caucaia_amostra' then 'Caucaia (Amostra)'
        when 'nvtr_ce_quixada' then 'Quixadá'
        else source_key
    end as nome
from origens
