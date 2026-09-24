{{ config(alias='dim_pessoa') }}

select *
from {{ ref('dim_pessoa') }}
