# Ícones para alternância de tema

## Objetivo

Substituir o controle visual de trilho do modo claro/escuro por um botão compacto com um ícone familiar, tornando a ação de troca de estilo mais evidente sem alterar o comportamento existente.

## Decisão de design

- Usar o componente `Button` existente com `variant="ghost"` e `size="icon"`.
- Renderizar `Moon` quando o tema atual for claro, indicando que o próximo estado será o modo escuro.
- Renderizar `Sun` quando o tema atual for escuro, indicando que o próximo estado será o modo claro.
- Manter o clique alternando entre `light` e `dark` por meio do `ThemeProvider`.
- Manter acessibilidade com `aria-label` dinâmico: `Ativar modo escuro` ou `Ativar modo claro`.

## Escopo

Alterar apenas `apps/web/src/components/theme-toggle.tsx` e adicionar testes específicos para os dois estados e a alternância. Não haverá mudanças no armazenamento do tema, nas rotas ou no estilo global.

## Critérios de aceite

1. O controle não renderiza mais o `Switch`.
2. No tema claro, o botão exibe o ícone de lua e o rótulo `Ativar modo escuro`.
3. No tema escuro, o botão exibe o ícone de sol e o rótulo `Ativar modo claro`.
4. Um clique continua persistindo o novo tema e aplicando/removendo a classe `dark` no elemento raiz.
5. Os testes da aplicação web e o build TypeScript passam.
