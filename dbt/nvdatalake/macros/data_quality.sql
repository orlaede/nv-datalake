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
{%- set dbname = env_var('NVDATALAKE_DBNAME', '') -%}
{%- set schemas = fromjson(env_var('NVDATALAKE_SCHEMAS', '[]')) -%}
{%- if execute and schemas | length == 0 -%}
    {{ exceptions.raise_compiler_error('NVDATALAKE_DBNAME / NVDATALAKE_SCHEMAS are not set; run the dbt project through the Kestra flow') }}
{%- endif -%}
select source_key
from (
    {%- for schema in schemas %}
    select '{{ dbname ~ '_' ~ schema }}' as source_key, count(*) as expected
    from {{ api.Relation.create(database=target.database, schema='bronze', identifier=dbname ~ '_' ~ schema ~ '__' ~ table_name) }}
    {% if not loop.last %}union all{% endif %}
    {%- endfor %}
) expected
left join (
    select source_key, count(*) as actual from {{ model }} group by source_key
) actual using (source_key)
where expected.expected != coalesce(actual.actual, 0)
{% endtest %}
