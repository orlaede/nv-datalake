{{ config(alias='dim_auto') }}

select *
from {{ ref('dim_auto') }}
