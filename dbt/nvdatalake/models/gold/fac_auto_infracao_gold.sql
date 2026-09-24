{{ config(alias='fac_auto_infracao') }}

select *
from {{ ref('fac_auto_infracao') }}
