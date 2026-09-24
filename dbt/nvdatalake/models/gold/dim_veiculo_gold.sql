{{ config(alias='dim_veiculo') }}

select *
from {{ ref('dim_veiculo') }}
