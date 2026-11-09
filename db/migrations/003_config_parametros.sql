-- Parâmetros de configuração do Data Lake, em pares chave/valor por origem.
-- Fora de bronze/silver/gold: esses schemas são recriados pelo pipeline.
-- Idempotente; aplicada manualmente, como as demais migrações.
--
-- source_key = <dbname>_<schema> (ex.: nvtr_sc_pomerode) ou '*' (vale para todas
-- as origens; o valor da própria origem sobrescreve).

CREATE SCHEMA IF NOT EXISTS config;

CREATE TABLE IF NOT EXISTS config.parametro (
    source_key text NOT NULL,
    chave text NOT NULL,
    valor text NOT NULL,
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source_key, chave),
    CONSTRAINT parametro_chave_valida CHECK (chave IN (
        'data_inicial_padrao', 'data_inicial_autos', 'tipo_envio_processamento',
        'receptor_processamento', 'num_dias_retencao_processamento')),
    CONSTRAINT parametro_data_valida CHECK (
        chave NOT IN ('data_inicial_padrao', 'data_inicial_autos') OR valor ~ '^\d{4}-\d{2}-\d{2}$'),
    CONSTRAINT parametro_dias_valido CHECK (
        chave <> 'num_dias_retencao_processamento' OR valor ~ '^\d+$'),
    CONSTRAINT parametro_padrao_global CHECK (
        chave <> 'data_inicial_padrao' OR source_key = '*')
);

COMMENT ON TABLE config.parametro IS
    'Parâmetros chave/valor por origem. source_key ''*'' = todas as origens.';
COMMENT ON COLUMN config.parametro.chave IS
    'data_inicial_padrao (só ''*''), data_inicial_autos, tipo_envio_processamento, receptor_processamento, num_dias_retencao_processamento.';
COMMENT ON COLUMN config.parametro.valor IS
    'Texto. Datas em AAAA-MM-DD; num_dias_retencao_processamento inteiro >= 0.';

-- Padrão inicial: só autos a partir de 2026-01-01 (não sobrescreve se já existir).
INSERT INTO config.parametro (source_key, chave, valor)
VALUES ('*', 'data_inicial_padrao', '2026-01-01')
ON CONFLICT (source_key, chave) DO NOTHING;
