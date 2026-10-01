{% test unique_key(model, columns) %}
select {{ columns | join(', ') }}
from {{ model }}
group by {{ columns | join(', ') }}
having count(*) > 1
{% endtest %}

{% test same_rows(model, compare_model) %}
(select * from {{ model }} except all select * from {{ ref(compare_model) }})
union all
(select * from {{ ref(compare_model) }} except all select * from {{ model }})
{% endtest %}

{% test staging_count(model, table_name) %}
select source_key
from (
    select 'nvtr_ce_caucaia_amostra' as source_key, count(*) as expected
    from {{ source('bronze', 'nvtr_ce_caucaia_amostra__' ~ table_name) }}
    union all
    select 'nvtr_ce_quixada' as source_key, count(*) as expected
    from {{ source('bronze', 'nvtr_ce_quixada__' ~ table_name) }}
) expected
left join (
    select source_key, count(*) as actual from {{ model }} group by source_key
) actual using (source_key)
where expected.expected != coalesce(actual.actual, 0)
{% endtest %}
