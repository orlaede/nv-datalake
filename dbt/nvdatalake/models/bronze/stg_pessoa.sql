select
    id, cnh, cnpj, cpf, emissor_rg, nome, outro_doc, rg, tipo_outro_doc, uf_cnh_id,
    categoria_cnh, situacao_cnh, validade_cnh, data_nascimento, data_primeira_cnh,
    data_validade_cnh, endereco, telefone, uf_rg_id, sexo, email, situacao_habilitacao,
    'nvtr_ce_caucaia_amostra' as source_key
from {{ source('bronze', 'nvtr_ce_caucaia_amostra__pessoa') }}
union all
select
    id, cnh, cnpj, cpf, emissor_rg, nome, outro_doc, rg, tipo_outro_doc, uf_cnh_id,
    categoria_cnh, situacao_cnh, validade_cnh, data_nascimento, data_primeira_cnh,
    data_validade_cnh, endereco, telefone, uf_rg_id, sexo, email, null as situacao_habilitacao,
    'nvtr_ce_quixada' as source_key
from {{ source('bronze', 'nvtr_ce_quixada__pessoa') }}
