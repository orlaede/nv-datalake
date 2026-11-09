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

{% test staging_count(model, table_name, optional=false) %}
{%- set dbname = env_var('NVDATALAKE_DBNAME', '') -%}
{%- set schemas = fromjson(env_var('NVDATALAKE_SCHEMAS', '[]')) -%}
{%- if execute and schemas | length == 0 -%}
    {{ exceptions.raise_compiler_error('NVDATALAKE_DBNAME / NVDATALAKE_SCHEMAS are not set; run the dbt project through the Kestra flow') }}
{%- endif -%}
{%- set present = [] -%}
{%- for schema in schemas -%}
    {%- set relation = api.Relation.create(database=target.database, schema='bronze', identifier=dbname ~ '_' ~ schema ~ '__' ~ table_name) -%}
    {%- if not optional or not execute or adapter.get_columns_in_relation(relation) | length > 0 -%}
        {%- do present.append({'key': dbname ~ '_' ~ schema, 'relation': relation}) -%}
    {%- endif -%}
{%- endfor -%}
{%- if present | length == 0 -%}
select null::text as source_key where false
{%- else -%}
select source_key
from (
    {%- for item in present %}
    select '{{ item['key'] }}' as source_key, count(*) as expected
    from {{ item['relation'] }}
    {% if not loop.last %}union all{% endif %}
    {%- endfor %}
) expected
left join (
    select source_key, count(*) as actual from {{ model }} group by source_key
) actual using (source_key)
where expected.expected != coalesce(actual.actual, 0)
{%- endif %}
{% endtest %}
