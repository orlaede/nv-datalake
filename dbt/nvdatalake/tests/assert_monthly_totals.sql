with expected as (
    select date_trunc('month', data_hora) as mes,
           sk_origem, sk_infracao, sk_agente, medicao_id, count(*) as total_autos
    from {{ ref('fac_auto_infracao') }}
    group by 1, 2, 3, 4, 5
)
(select * from expected except all select * from {{ ref('fac_auto_infracao_mensal') }})
union all
(select * from {{ ref('fac_auto_infracao_mensal') }} except all select * from expected)
