export const GOLD_STAR_FROM = `gold.fac_auto_infracao ai
       left join gold.dim_agente agente on agente.sk_agente = ai.sk_agente
       left join gold.dim_infracao infracao on infracao.sk_infracao = ai.sk_infracao
       left join gold.dim_origem origem on origem.sk_origem = ai.sk_origem`

export const AGENTE_EXPR = `agente.nome`
export const LOCAL_EXPR = `ai.logradouro`
export const TIPO_EXPR = `(case when infracao.abordagem = 'S' then 'Com Abordagem' else 'Sem Abordagem' end)`
export const CODIGO_EXPR = `infracao.codigo::text`
export const EQUIPAMENTO_EXPR = `ai.android_serial`
export const PERIODO_EXPR = `(case when extract(hour from ai.data_hora) >= 0 and extract(hour from ai.data_hora) < 12 then 'Manhã' when extract(hour from ai.data_hora) >= 12 and extract(hour from ai.data_hora) < 18 then 'Tarde' else 'Noite' end)`
export const DATA_HORA_EXPR = `ai.data_hora`
export const COMPETENCIA_EXPR = `(case when infracao.competencia = 'MUN/ROD' then 'Municipal/Rodoviário' when infracao.competencia = 'EST/MUN/ROD' then 'Estadual/Municipal/Rodoviário' when infracao.competencia = 'EST/ROD' then 'Estadual/Rodoviário' when infracao.competencia = 'EST' then 'Estadual' when infracao.competencia = 'ROD' then 'Rodoviário' when infracao.competencia = 'INDEFINIDA' then 'Indefinida' end)`
export const STATUS_EXPR = `(case when ai.status = 'CANCELADO_GESTOR' then 'Cancelado pelo Gestor' when ai.status = 'CANCELADO_OFF' then 'Cancelado pelo Agente' when ai.status = 'CANCELAMENTO_SOLICITADO_OFF' then 'Cancelamento Solicitado pelo Agente' when ai.status = 'VALIDO_OFF' then 'Válido' end)`
export const MOTIVO_CANCELAMENTO_EXPR = `coalesce(ai.justificativa_cancelamento, ai.justificativa_cancelamento_gestor)`
export const ORIGEM_EXPR = `origem.nome`
