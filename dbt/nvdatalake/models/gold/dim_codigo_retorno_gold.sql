{{ config(alias='dim_codigo_retorno') }}

select *
from {{ ref('dim_codigo_retorno') }}
