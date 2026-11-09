{{ config(alias='dim_parametro_origem') }}

select *
from {{ ref('dim_parametro_origem') }}
