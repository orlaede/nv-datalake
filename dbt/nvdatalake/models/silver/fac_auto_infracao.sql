select
    f.source_key,
    f.id,
    f.android_serial,
    f.data_hora_fim,
    f.data_hora_inicio,
    f.doc_transportador_embarcador,
    f.hash,
    f.justificativa_cancelamento,
    f.logradouro,
    f.numero,
    f.ponto_referencia,
    f.sentido,
    f.medidas_administrativas,
    f.nome_transportador_embarcador,
    f.num_auto,
    f.observacao,
    f.sem_abordagem,
    f.status,
    coalesce(agente.sk_agente, 0) as sk_agente,
    coalesce(condutor.sk_pessoa, 0) as sk_condutor,
    coalesce(infracao.sk_infracao, 0) as sk_infracao,
    coalesce(infrator.sk_pessoa, 0) as sk_infrator,
    coalesce(municipio.sk_municipio, 0) as sk_municipio,
    f.medicao_id,
    coalesce(veiculo.sk_veiculo, 0) as sk_veiculo,
    f.data_hora,
    f.status_processamento,
    coalesce(erro.sk_erro_consistencia, 0) as sk_erro_consistencia,
    f.imei,
    f.status_arquivamento,
    f.justificativa_cancelamento_gestor,
    f.latitude,
    f.longitude,
    f.arquivo_ftp_id,
    f.motivo_nao_abordagem,
    f.motivo_cancelamento
from {{ ref('stg_auto_infracao') }} f
left join {{ ref('dim_agente') }} agente
    on f.source_key = agente.source_key and f.agente_id = agente.id
left join {{ ref('dim_pessoa') }} condutor
    on f.source_key = condutor.source_key and f.condutor_id = condutor.id
left join {{ ref('dim_infracao') }} infracao
    on f.source_key = infracao.source_key and f.infracao_id = infracao.id
left join {{ ref('dim_pessoa') }} infrator
    on f.source_key = infrator.source_key and f.infrator_id = infrator.id
left join {{ ref('dim_municipio') }} municipio
    on f.municipio_codigo = municipio.codigo
left join {{ ref('dim_veiculo') }} veiculo
    on f.source_key = veiculo.source_key and f.veiculo_id = veiculo.id
left join {{ ref('dim_erro_consistencia') }} erro
    on f.source_key = erro.source_key and f.erro_consistencia_id = erro.id
