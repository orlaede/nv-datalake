-- Uma linha por origem (sk_origem), em colunas, a partir de config.parametro
-- (chave/valor; db/migrations/003_config_parametros.sql, fora do pipeline).
-- Vale o valor da própria origem; sem ele, o de source_key '*'.
-- data_inicial_autos = data_inicial_autos da origem, senão data_inicial_padrao ('*').
with candidatos as (
    select
        o.source_key,
        p.chave,
        p.valor,
        p.atualizado_em,
        p.source_key = o.source_key as propria
    from {{ ref('dim_origem') }} o
    join config.parametro p
        on p.source_key in (o.source_key, '*')
),

efetivo as (
    select
        source_key,
        chave,
        (array_agg(valor order by propria desc))[1] as valor,
        max(atualizado_em) as atualizado_em
    from candidatos
    group by source_key, chave
)

select
    o.sk_origem,
    o.source_key,
    max(case when e.chave = 'tipo_envio_processamento' then e.valor end) as tipo_envio_processamento,
    max(case when e.chave = 'receptor_processamento' then e.valor end) as receptor_processamento,
    max(case when e.chave = 'num_dias_retencao_processamento' then e.valor::integer end) as num_dias_retencao_processamento,
    coalesce(
        max(case when e.chave = 'data_inicial_autos' then e.valor::date end),
        max(case when e.chave = 'data_inicial_padrao' then e.valor::date end)
    ) as data_inicial_autos,
    max(e.atualizado_em) as atualizado_em
from {{ ref('dim_origem') }} o
left join efetivo e
    on o.source_key = e.source_key
group by o.sk_origem, o.source_key
