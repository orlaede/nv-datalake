{{ config(alias='fac_ait_retorno') }}

select *
from {{ ref('fac_ait_retorno') }}
