select
    f.source_key,
    coalesce(origem.sk_origem, 0) as sk_origem,
    f.id,
    nullif(trim(f.num_auto), '') as num_auto,
    coalesce(auto_dim.sk_auto, 0) as sk_auto,
    coalesce(retorno.sk_codigo_retorno, 0) as sk_codigo_retorno,
    (timezone('America/Sao_Paulo', now())::date - auto_fato.data_hora::date) as num_dias
from {{ ref('stg_ait_retorno') }} f
left join {{ ref('dim_auto') }} auto_dim
    on f.source_key = auto_dim.source_key and nullif(trim(f.num_auto), '') = auto_dim.num_auto
left join {{ ref('fac_auto_infracao') }} auto_fato
    on auto_dim.sk_auto = auto_fato.sk_auto and auto_fato.sk_auto > 0
left join {{ ref('dim_codigo_retorno') }} retorno
    on f.source_key = retorno.source_key and f.codigo_retorno = retorno.id
left join {{ ref('dim_origem') }} origem
    on f.source_key = origem.source_key
