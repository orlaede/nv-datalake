{{ config(alias='fac_auto_infracao') }}

select
    ai.data_hora as "Data e Hora",
    ai.num_auto as "Número do Auto",
    ai.android_serial as "Equipamento",
    agente.nome as "Nome do Agente",
    infracao.codigo as "Código da Infração",
    case
        when infracao.abordagem = 'S' then 'Com Abordagem'
        else 'Sem Abordagem'
    end as "Tipo Infração",
    infracao.descricao as "Descrição da Infração",
    date_part('year', ai.data_hora) as "Ano",
    date_part('month', ai.data_hora) as "Mês",
    date_part('day', ai.data_hora) as "Dia",
    date_part('hour', ai.data_hora) as "Hora",
    date_part('week', ai.data_hora) as "Semana do Ano",
    case date_part('dow', ai.data_hora)
        when 0 then 'Domingo'
        when 1 then 'Segunda'
        when 2 then 'Terça'
        when 3 then 'Quarta'
        when 4 then 'Quinta'
        when 5 then 'Sexta'
        when 6 then 'Sábado'
    end as "Dia da Semana",
    case
        when date_part('hour', ai.data_hora) >= 0
            and date_part('hour', ai.data_hora) < 12 then 'Manhã'
        when date_part('hour', ai.data_hora) >= 12
            and date_part('hour', ai.data_hora) < 18 then 'Tarde'
        when date_part('hour', ai.data_hora) >= 18
            and date_part('hour', ai.data_hora) <= 24 then 'Noite'
    end as "Turno",
    case
        when infracao.competencia = 'MUN/ROD' then 'Municipal/Rodoviário'
        when infracao.competencia = 'EST/MUN/ROD' then 'Estadual/Municipal/Rodoviário'
        when infracao.competencia = 'EST/ROD' then 'Estadual/Rodoviário'
        when infracao.competencia = 'EST' then 'Estadual'
        when infracao.competencia = 'ROD' then 'Rodoviário'
        when infracao.competencia = 'INDEFINIDA' then 'Indefinida'
    end as "Competência",
    case
        when ai.status = 'CANCELADO_GESTOR' then 'Cancelado pelo Gestor'
        when ai.status = 'CANCELADO_OFF' then 'Cancelado pelo Agente'
        when ai.status = 'CANCELAMENTO_SOLICITADO_OFF' then 'Cancelamento Solicitado pelo Agente'
        when ai.status = 'VALIDO_OFF' then 'Válido'
    end as "Status do Auto",
    ai.justificativa_cancelamento as "Justificativa do Cancelamento pelo Agente",
    ai.justificativa_cancelamento_gestor as "Justificativa do Cancelamento pelo Gestor",
    ai.logradouro as "Logradouro",
    ai.numero
from {{ ref('fac_auto_infracao') }} ai
left join {{ ref('dim_agente') }} agente
    on agente.sk_agente = ai.sk_agente
left join {{ ref('dim_infracao') }} infracao
    on infracao.sk_infracao = ai.sk_infracao
