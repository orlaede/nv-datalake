{{ config(alias='dim_erro_consistencia') }}

select *
from {{ ref('dim_erro_consistencia') }}
