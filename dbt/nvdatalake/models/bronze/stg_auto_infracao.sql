select
    id, android_serial, data_hora_fim, data_hora_inicio, doc_transportador_embarcador,
    hash, justificativa_cancelamento, logradouro, numero, ponto_referencia, sentido,
    medidas_administrativas, nome_transportador_embarcador, num_auto, observacao,
    sem_abordagem, status, agente_id, condutor_id, infracao_id, infrator_id,
    municipio_codigo, medicao_id, veiculo_id, data_hora, status_processamento,
    erro_consistencia_id, imei, status_arquivamento, justificativa_cancelamento_gestor,
    latitude, longitude, arquivo_ftp_id, motivo_nao_abordagem, motivo_cancelamento,
    'nvtr_ce_caucaia_amostra' as source_key
from {{ source('bronze', 'nvtr_ce_caucaia_amostra__auto_infracao') }}
union all
select
    id, android_serial, data_hora_fim, data_hora_inicio, doc_transportador_embarcador,
    hash, justificativa_cancelamento, logradouro, numero, ponto_referencia, sentido,
    medidas_administrativas, nome_transportador_embarcador, num_auto, observacao,
    sem_abordagem, status, agente_id, condutor_id, infracao_id, infrator_id,
    municipio_codigo, medicao_id, veiculo_id, data_hora, status_processamento,
    erro_consistencia_id, imei, status_arquivamento, justificativa_cancelamento_gestor,
    latitude, longitude, arquivo_ftp_id, motivo_nao_abordagem, null as motivo_cancelamento,
    'nvtr_ce_quixada' as source_key
from {{ source('bronze', 'nvtr_ce_quixada__auto_infracao') }}
