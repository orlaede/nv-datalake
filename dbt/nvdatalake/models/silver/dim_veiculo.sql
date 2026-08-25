with base as (
    select
        source_key,
        id,
        anofabricacao,
        chassi,
        modelo,
        outramarca,
        placa,
        renavam,
        cor_id,
        especie_id,
        marca_id,
        pais_id,
        proprietario_id,
        uf_id,
        tipo_id,
        marcamodelo
    from {{ ref('stg_veiculo') }}
)

select
    row_number() over (order by source_key, id) as sk_veiculo,
    source_key,
    id,
    anofabricacao,
    chassi,
    modelo,
    outramarca,
    placa,
    renavam,
    cor_id,
    especie_id,
    marca_id,
    pais_id,
    proprietario_id,
    uf_id,
    tipo_id,
    marcamodelo
from base

union all

select
    0 as sk_veiculo,
    null as source_key,
    0 as id,
    null as anofabricacao,
    null as chassi,
    'Não Informado' as modelo,
    null as outramarca,
    null as placa,
    null as renavam,
    null as cor_id,
    null as especie_id,
    null as marca_id,
    null as pais_id,
    null as proprietario_id,
    null as uf_id,
    null as tipo_id,
    null as marcamodelo
