# Kestra: ingestão Bronze e transformações dbt

Desenho aprovado em 2026-10-01. Branch: `codex/integracao-kestra`.

## Escopo

Kestra será uma alternativa completa ao Dagster, que permanece disponível.
Ambos usam `SOURCES` e a mesma função de carga Bronze, preservando nomes e tipos
PostgreSQL. O fluxo carrega todas as 14 tabelas das duas origens antes de executar
o projeto dbt inteiro: 7 staging, 8 modelos Silver e 9 Gold.

## Execução

Uma imagem Kestra versionada contém Python, as dependências travadas existentes,
o carregador e todo o projeto dbt. Process runner executa as tarefas sem acesso
ao socket Docker. Um PostgreSQL exclusivo persiste o estado do orquestrador;
os bancos de origem e destino continuam externos. Compose usa profile `kestra`.
Cada execução recebe uma cópia independente do projeto dbt e armazena manifest,
run_results e documentação no storage persistente do Kestra.

O fluxo executa ingestão → dbt deps/debug → dbt build → dbt docs generate.
Falhas interrompem o fluxo; execução concorrente fica enfileirada. O agendamento
equivalente ao Dagster (03:00 America/Sao_Paulo) começa desabilitado para evitar
cargas simultâneas. As credenciais vêm do ambiente, sem serem incorporadas à imagem.

## Verificação

Testes cobrem configurações e inventário completo, preservação de tipos nullable,
separação de origens com IDs iguais, resolução de dimensões ausentes para chave 0,
schema drift de pessoa/auto, deduplicação de municípios, espelhamento Gold e
agregados mensais. Testes dbt verificam chaves e relações em todos os modelos.
O teste de ponta a ponta importa o fluxo no Kestra real, executa e verifica todas
as tabelas e artefatos, repetibilidade e bloqueio do dbt quando a ingestão falha.
Bancos de teste isolados não usam credenciais de produção. A conclusão distingue
validação isolada de execução nas bases reais.
