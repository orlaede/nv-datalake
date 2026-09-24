{{ config(alias='dim_origem') }}

select *
from {{ ref('dim_origem') }}
