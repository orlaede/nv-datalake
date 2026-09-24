{{ config(alias='dim_infracao') }}

select *
from {{ ref('dim_infracao') }}
