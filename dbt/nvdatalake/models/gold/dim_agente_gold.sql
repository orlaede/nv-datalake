{{ config(alias='dim_agente') }}

select *
from {{ ref('dim_agente') }}
