-- Synthetic data only. Applied exclusively to the isolated test source database.
CREATE SCHEMA ce_caucaia_amostra;
CREATE SCHEMA ce_quixada;

CREATE TABLE ce_caucaia_amostra.agente (
    id bigint, matricula text, nome text, nome_guerra text,
    lotacao_id bigint, usuario_id bigint, convenio_id bigint
);
CREATE TABLE ce_caucaia_amostra.infracao (
    id bigint, descricao text, enquadramento text, obs_sugerida text,
    pontos_cnh integer, tipo_infrator integer, tipo_medicao integer,
    competencia integer, version integer, codigo text,
    vigencia_inicio date, vigencia_fim date, abordagem boolean,
    orientacao_fiscalizacao text
);
CREATE TABLE ce_caucaia_amostra.municipio (
    codigo bigint, descricao text, uf_id bigint, version integer
);
CREATE TABLE ce_caucaia_amostra.pessoa (
    id bigint, cnh text, cnpj text, cpf text, emissor_rg text, nome text,
    outro_doc text, rg text, tipo_outro_doc integer, uf_cnh_id bigint,
    categoria_cnh text, situacao_cnh integer, validade_cnh date,
    data_nascimento date, data_primeira_cnh date, data_validade_cnh date,
    endereco text, telefone text, uf_rg_id bigint, sexo integer, email text,
    situacao_habilitacao text
);
CREATE TABLE ce_caucaia_amostra.veiculo (
    id bigint, anofabricacao integer, chassi text, modelo text, outramarca text,
    placa text, renavam text, cor_id bigint, especie_id bigint, marca_id bigint,
    pais_id bigint, proprietario_id bigint, uf_id bigint, tipo_id bigint, marcamodelo text
);
CREATE TABLE ce_caucaia_amostra.erro_consistencia (id bigint, descricao text);
CREATE TABLE ce_caucaia_amostra.auto_infracao (
    id bigint, android_serial text, data_hora_fim timestamp, data_hora_inicio timestamp,
    doc_transportador_embarcador text, hash text, justificativa_cancelamento text,
    logradouro text, numero text, ponto_referencia text, sentido text,
    medidas_administrativas text, nome_transportador_embarcador text, num_auto text,
    observacao text, sem_abordagem boolean, status integer,
    agente_id bigint, condutor_id bigint, infracao_id bigint, infrator_id bigint,
    municipio_codigo bigint, medicao_id bigint, veiculo_id bigint, data_hora timestamp,
    status_processamento integer, erro_consistencia_id bigint, imei text,
    status_arquivamento integer, justificativa_cancelamento_gestor text,
    latitude numeric(10,6), longitude numeric(10,6), arquivo_ftp_id bigint,
    motivo_nao_abordagem text, motivo_cancelamento text
);

CREATE TABLE ce_quixada.agente (LIKE ce_caucaia_amostra.agente);
CREATE TABLE ce_quixada.infracao (LIKE ce_caucaia_amostra.infracao);
CREATE TABLE ce_quixada.municipio (LIKE ce_caucaia_amostra.municipio);
CREATE TABLE ce_quixada.pessoa (LIKE ce_caucaia_amostra.pessoa);
ALTER TABLE ce_quixada.pessoa DROP COLUMN situacao_habilitacao;
CREATE TABLE ce_quixada.veiculo (LIKE ce_caucaia_amostra.veiculo);
CREATE TABLE ce_quixada.erro_consistencia (LIKE ce_caucaia_amostra.erro_consistencia);
CREATE TABLE ce_quixada.auto_infracao (LIKE ce_caucaia_amostra.auto_infracao);
ALTER TABLE ce_quixada.auto_infracao DROP COLUMN motivo_cancelamento;

INSERT INTO ce_caucaia_amostra.agente (id, matricula, nome, usuario_id) VALUES (1, 'C001', 'Agente Caucaia', NULL);
INSERT INTO ce_quixada.agente (id, matricula, nome, usuario_id) VALUES (1, 'Q001', 'Agente Quixada', 7);
INSERT INTO ce_caucaia_amostra.infracao (id, descricao, pontos_cnh, abordagem) VALUES (1, 'Infração Caucaia', 7, true);
INSERT INTO ce_quixada.infracao (id, descricao, pontos_cnh, abordagem) VALUES (1, 'Infração Quixada', 5, false);
INSERT INTO ce_caucaia_amostra.municipio VALUES (2304400, 'Fortaleza', 23, 0);
-- Same IBGE code with different descriptive/version fields must still be one city.
INSERT INTO ce_quixada.municipio VALUES (2304400, 'FORTALEZA', 23, 1);
INSERT INTO ce_caucaia_amostra.pessoa (id, nome, situacao_habilitacao) VALUES (1, 'Ana', 'REGULAR');
INSERT INTO ce_quixada.pessoa (id, nome) VALUES (1, 'Beto');
INSERT INTO ce_caucaia_amostra.veiculo (id, placa, modelo, proprietario_id) VALUES (1, 'AAA0001', 'Veículo Caucaia', 1);
INSERT INTO ce_quixada.veiculo (id, placa, modelo, proprietario_id) VALUES (1, 'BBB0002', 'Veículo Quixada', 1);
INSERT INTO ce_caucaia_amostra.erro_consistencia VALUES (1, 'Erro Caucaia');
INSERT INTO ce_quixada.erro_consistencia VALUES (1, 'Erro Quixada');

INSERT INTO ce_caucaia_amostra.auto_infracao
    (id, num_auto, agente_id, condutor_id, infracao_id, infrator_id, municipio_codigo,
     medicao_id, veiculo_id, data_hora, erro_consistencia_id, motivo_cancelamento, latitude)
VALUES
    (1, 'C001', 1, 1, 1, 1, 2304400, 10, 1, '2026-01-10 10:00', 1, 'JUSTIFICADO', -3.123456),
    (2, 'C002', 1, 1, 1, 1, 2304400, 10, 1, '2026-01-20 11:00', 1, NULL, NULL),
    (3, 'C003', 999, NULL, 999, 999, 999, NULL, 999, '2026-02-05 12:00', NULL, NULL, NULL);
INSERT INTO ce_quixada.auto_infracao
    (id, num_auto, agente_id, condutor_id, infracao_id, infrator_id, municipio_codigo,
     medicao_id, veiculo_id, data_hora, erro_consistencia_id)
VALUES
    (1, 'Q001', 1, 1, 1, 1, 2304400, 10, 1, '2026-01-10 10:00', 1),
    (2, 'Q002', 1, 1, 1, 1, 2304400, 10, 1, '2026-01-20 11:00', 1),
    (3, 'Q003', 999, NULL, 999, 999, 999, NULL, 999, '2026-02-05 12:00', NULL);
