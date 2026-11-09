-- Synthetic data only. Applied exclusively to the isolated test source database.
CREATE SCHEMA ce_caucaia_amostra;
CREATE SCHEMA sc_pomerode;
CREATE SCHEMA sc_bcamboriu;
CREATE SCHEMA sc_brusquet;
CREATE SCHEMA sc_criciumat;
CREATE SCHEMA pr_curitiba;

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

INSERT INTO ce_caucaia_amostra.agente (id, matricula, nome, usuario_id) VALUES (1, 'C001', 'Agente Caucaia', NULL);
INSERT INTO ce_caucaia_amostra.infracao (id, descricao, pontos_cnh, abordagem) VALUES (1, 'Infração Caucaia', 7, true);
INSERT INTO ce_caucaia_amostra.municipio VALUES (2304400, 'Fortaleza', 23, 0);
INSERT INTO ce_caucaia_amostra.pessoa (id, nome, situacao_habilitacao) VALUES (1, 'Ana', 'REGULAR');
INSERT INTO ce_caucaia_amostra.veiculo (id, placa, modelo, proprietario_id) VALUES (1, 'AAA0001', 'Veículo Caucaia', 1);
INSERT INTO ce_caucaia_amostra.erro_consistencia VALUES (1, 'Erro Caucaia');

INSERT INTO ce_caucaia_amostra.auto_infracao
    (id, num_auto, agente_id, condutor_id, infracao_id, infrator_id, municipio_codigo,
     medicao_id, veiculo_id, data_hora, erro_consistencia_id, motivo_cancelamento, latitude)
VALUES
    (1, 'C001', 1, 1, 1, 1, 2304400, 10, 1, '2026-01-10 10:00', 1, 'JUSTIFICADO', -3.123456),
    (2, 'C002', 1, 1, 1, 1, 2304400, 10, 1, '2026-01-20 11:00', 1, NULL, NULL),
    (3, 'C003', 999, NULL, 999, 999, 999, NULL, 999, '2026-02-05 12:00', NULL, NULL, NULL);

-- Remaining schemas mirror ce_caucaia_amostra, then drift like the real sources.
DO $$
DECLARE
    schemas text[] = ARRAY['sc_pomerode', 'sc_bcamboriu', 'pr_curitiba', 'sc_brusquet', 'sc_criciumat'];
    labels text[] = ARRAY['Pomerode', 'Bcamboriu', 'Curitiba', 'Brusquet', 'Criciumat'];
    s text;
    l text;
    t text;
BEGIN
    FOR i IN 1..5 LOOP
        s = schemas[i];
        l = labels[i];
        FOREACH t IN ARRAY ARRAY['agente', 'infracao', 'municipio', 'pessoa', 'veiculo', 'erro_consistencia', 'auto_infracao'] LOOP
            EXECUTE format('CREATE TABLE %I.%I (LIKE ce_caucaia_amostra.%I)', s, t, t);
        END LOOP;
        EXECUTE format('INSERT INTO %I.agente (id, matricula, nome, usuario_id) VALUES (1, %L, %L, 9)', s, l, 'Agente ' || l);
        EXECUTE format('INSERT INTO %I.infracao (id, descricao, pontos_cnh, abordagem) VALUES (1, %L, 3, true)', s, 'Infração ' || l);
        EXECUTE format('INSERT INTO %I.municipio VALUES (2304400, %L, 23, 0)', s, 'Fortaleza');
        EXECUTE format('INSERT INTO %I.pessoa (id, nome) VALUES (1, %L)', s, 'Pessoa ' || l);
        EXECUTE format('INSERT INTO %I.veiculo (id, placa, modelo, proprietario_id) VALUES (1, %L, %L, 1)', s, upper(left(l, 3)) || '0001', 'Veículo ' || l);
        EXECUTE format('INSERT INTO %I.erro_consistencia VALUES (1, %L)', s, 'Erro ' || l);
        EXECUTE format($q$INSERT INTO %I.auto_infracao
            (id, num_auto, agente_id, condutor_id, infracao_id, infrator_id, municipio_codigo,
             medicao_id, veiculo_id, data_hora, erro_consistencia_id)
            VALUES
            (1, %L, 1, 1, 1, 1, 2304400, 10, 1, '2026-01-10 10:00', 1),
            (2, %L, 1, 1, 1, 1, 2304400, 10, 1, '2026-01-20 11:00', 1),
            (3, %L, 999, NULL, 999, 999, 999, NULL, 999, '2026-02-05 12:00', NULL)$q$,
            s, l || '1', l || '2', l || '3');
    END LOOP;
END $$;

ALTER TABLE sc_pomerode.auto_infracao ADD COLUMN cod_pre_auto text;
ALTER TABLE sc_pomerode.infracao ADD COLUMN valor numeric(10,2);
ALTER TABLE sc_pomerode.veiculo ADD COLUMN exercicio integer;
ALTER TABLE sc_bcamboriu.auto_infracao ADD COLUMN arquivo_ftp_retorno_id bigint;
ALTER TABLE sc_bcamboriu.auto_infracao DROP COLUMN motivo_cancelamento;
ALTER TABLE pr_curitiba.infracao ADD COLUMN orgao_interposicao text;
ALTER TABLE pr_curitiba.pessoa DROP COLUMN situacao_habilitacao;

-- Same IBGE code with different descriptive/version fields must still be one city.
UPDATE sc_pomerode.municipio SET descricao = 'FORTALEZA', version = 1;

-- Optional tables ait_retorno / codigo_retorno (real structure): present only in
-- sc_pomerode and pr_curitiba, absent elsewhere. 
CREATE TABLE sc_pomerode.codigo_retorno (id bigint PRIMARY KEY, codigo_retorno bigint, descricao varchar(255), retorno_sucesso boolean);
CREATE TABLE sc_pomerode.ait_retorno (id bigint PRIMARY KEY, num_auto varchar(255), codigo_retorno bigint REFERENCES sc_pomerode.codigo_retorno(id));
INSERT INTO sc_pomerode.codigo_retorno VALUES (1, 100, 'Aceito', true);
INSERT INTO sc_pomerode.ait_retorno VALUES (1, 'Pomerode1', 1), (2, 'Pomerode2', NULL);
CREATE TABLE pr_curitiba.codigo_retorno (id bigint PRIMARY KEY, codigo_retorno bigint, descricao varchar(255), retorno_sucesso boolean);
CREATE TABLE pr_curitiba.ait_retorno (id bigint PRIMARY KEY, num_auto varchar(255), codigo_retorno bigint REFERENCES pr_curitiba.codigo_retorno(id));
INSERT INTO pr_curitiba.codigo_retorno VALUES (1, 200, 'Rejeitado', false);
-- num_auto repeats ('Curitiba1' twice): an auto may be processed more than once.
-- ' Curitiba2 ' only links to its auto if num_auto is trimmed; 'ORFAO' has no auto (sk_auto = 0).
INSERT INTO pr_curitiba.ait_retorno VALUES (1, 'Curitiba1', 1), (2, ' Curitiba2 ', 1), (3, 'ORFAO', NULL), (4, 'Curitiba1', 1);
