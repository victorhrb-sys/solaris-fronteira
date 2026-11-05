# Solaris Fronteira

Jogo de estratégia espacial por turnos, com conquista de estrelas, economia,
frotas, baterias e névoa de guerra. Um humano pode enfrentar 1–7 bots; no site,
salas por convite permitem 2–8 impérios entre humanos e bots.

[Jogar no site existente](https://solaris-fronteira.victor-hrb.chatgpt.site)

## Experimentar localmente

Com Python 3, na raiz do projeto:

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory public
```

Abra **http://127.0.0.1:4173**. O modo local roda no navegador, sem compilação.
O servidor estático não oferece multiplayer online. O código de salas e seu
adaptador HTTP estão incluídos para estudo e testes; a implantação de produção
usa a hospedagem já existente.

## Ideia do jogo

Invista em economia para financiar expansão, em estaleiros para produzir frotas e
em baterias para defender posições. Reserve envios e confirme o turno: todas as
frotas avançam um tick e chegadas simultâneas disputam cada estrela. Controlar pelo
menos metade da galáxia encerra a partida.

- **896 mapas aprovados**, com 128 opções para cada quantidade de participantes.
- **81 perfis de bots**, combinando território, risco, distribuição e investimento.
- Rotas automáticas, relatórios de combate e saves locais compatíveis com versões anteriores.
- Interface compacta para celular, com mapa em foco e detalhes recolhidos.

## Entender o código

| Leitura | Conteúdo |
| --- | --- |
| [Arquitetura](docs/architecture.md) | Estado, visão de jogador, ordem do turno e concorrência online |
| [Regras atuais](docs/rules-current.md) | Custos, produção, alcance, combate e vitória |
| [Desenvolvimento](docs/development.md) | Comandos, cobertura dos testes e falha conhecida na simulação longa |
| [Origem e recursos](docs/attribution.md) | Referência ao Solaris, fonte e escopo da distribuição |

Comece por `public/engine.mjs`. A interface está em `public/app.mjs`, os bots em
`public/bot-planner.mjs` e o protocolo online em `server/rooms.mjs`.

## Verificar

Com Node.js 24 ou posterior, sem instalar dependências para o motor:

```sh
node scripts/test.mjs
```

As dez suítes cobrem mapas, regras, saves, rotas, combate, névoa, bots e protocolo
online em SQLite. A simulação longa é separada e possui uma falha preexistente de
limite de turnos, descrita no guia de desenvolvimento. O teste de navegador cobre
1440, 390 e 360 px e requer Playwright.

## Escopo

A distribuição pública reúne o jogo, o protocolo online, os testes e a documentação.
Não inclui dados de jogadores, histórico privado, identidade da hospedagem ou
ferramentas internas de publicação. Não cria nem substitui o site existente.
O modo online não possui prazo de turno, lobby público, chat ou ranking.

Projeto independente inspirado em Solaris. Nenhuma licença nova para o código
foi escolhida nesta revisão; consulte a nota de origem antes de redistribuir.
