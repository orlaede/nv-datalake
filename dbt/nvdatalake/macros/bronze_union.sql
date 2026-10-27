{#
    Union of one table across every source schema loaded into bronze.

    Schemas come from the Kestra flow (variables.dbname / variables.schemas),
    exposed as NVDATALAKE_DBNAME and NVDATALAKE_SCHEMAS (JSON list). Each
    schema lands in bronze as <dbname>_<schema>__<table>. Columns missing in
    a schema are filled with null, so schema drift between sources is tolerated.
#}
{% macro bronze_union(table) %}
    {%- if not execute -%}
        select 1
    {%- else -%}
        {%- set dbname = env_var('NVDATALAKE_DBNAME', '') -%}
        {%- set schemas = fromjson(env_var('NVDATALAKE_SCHEMAS', '[]')) -%}
        {%- if schemas | length == 0 -%}
            {{ exceptions.raise_compiler_error('NVDATALAKE_DBNAME / NVDATALAKE_SCHEMAS are not set; run the dbt project through the Kestra flow') }}
        {%- endif -%}

        {%- set sources = [] -%}
        {%- set all_columns = [] -%}
        {%- set column_types = {} -%}
        {%- for schema in schemas -%}
            {%- set key = dbname ~ '_' ~ schema -%}
            {%- set relation = api.Relation.create(database=target.database, schema='bronze', identifier=key ~ '__' ~ table) -%}
            {%- set relation_columns = adapter.get_columns_in_relation(relation) -%}
            {%- set columns = relation_columns | map(attribute='name') | list -%}
            {%- if columns | length == 0 -%}
                {{ exceptions.raise_compiler_error('bronze table not found: ' ~ relation) }}
            {%- endif -%}
            {%- do sources.append({'key': key, 'relation': relation, 'columns': columns}) -%}
            {%- for column in relation_columns -%}
                {%- if column.name not in all_columns -%}
                    {%- do all_columns.append(column.name) -%}
                    {%- do column_types.update({column.name: column.data_type}) -%}
                {%- endif -%}
            {%- endfor -%}
        {%- endfor -%}

        {%- for source in sources %}
        select
            {%- for column in all_columns %}
            {% if column in source['columns'] %}{{ adapter.quote(column) }}{% else %}null::{{ column_types[column] }} as {{ adapter.quote(column) }}{% endif %},
            {%- endfor %}
            '{{ source['key'] }}' as source_key
        from {{ source['relation'] }}
        {% if not loop.last %}union all{% endif %}
        {%- endfor -%}
    {%- endif -%}
{% endmacro %}
