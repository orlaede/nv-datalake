{{ config(alias='dim_municipio') }}

select *
from {{ ref('dim_municipio') }}
