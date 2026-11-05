# Como o jogo funciona

Solaris Fronteira transforma conquista espacial em decisões simultâneas por turno.
O jogador investe em estrelas, reserva naves e confirma sua preparação. O motor
resolve um tick completo; a interface apresenta o resultado. O mesmo conjunto de
regras atende partidas locais e salas online.

## Por onde começar a leitura

| Arquivo | Responsabilidade |
| --- | --- |
| `public/engine.mjs` | Criação, migração de saves, comandos, visão, combate e passagem de turno |
| `public/bot-planner.mjs` | Planejamento sem alterar o estado recebido |
| `public/bot-profiles.mjs` | Quatro eixos ativos, com três opções cada: 81 perfis |
| `public/approved-maps.mjs` | Banco das 896 geometrias aprovadas |
| `public/map-picker.mjs` | Sorteio sem repetição até terminar o banco de cada quantidade de participantes |
| `public/map-spacing.mjs` | Escalas calibradas, aplicadas somente a novas partidas |
| `public/app.mjs` | Mapa SVG, câmera, painéis, eventos e salvamento local |
| `public/online.mjs` | Comunicação HTTP, sala e confirmação de turno |
| `public/online-sessions.mjs` | Acessos locais às salas e arquivo pessoal de recuperação |
| `server/rooms.mjs` | Autorização, preparação privada e gravação concorrente das salas |
| `server/turn-summary.mjs` | Resumo do último tick envolvendo o próprio império |
| `app/api/rooms/route.ts` | Adaptador HTTP/D1 usado pela hospedagem |

## Estado completo e perspectiva

No modo local, `world` em `app.mjs` é a partida salva; `g` é o retorno de
`playerView(world, owner)` usado para desenhar a interface. Online, o servidor
mantém a partida completa e devolve apenas `roomView`, que aplica `playerView`.
Ocultar elementos na tela não substitui esse filtro no servidor.

`owner` é o índice do império. Em uma estrela, `-1` significa neutra; na
perspectiva, `null` significa que o dono está oculto. Em `winner`, `null` indica
partida em andamento e `-1` indica empate. Esses significados não são intercambiáveis.

Nomes e posições das estrelas são públicos. Estrelas próprias fornecem visão;
frotas não ampliam cobertura. Uma frota inimiga visível pode ter posição e direção
conhecidas sem revelar sua origem, destino ou tempo de chegada. Relatórios guardam
quem presenciou o combate, para que descobrir uma região depois não revele seu passado.

## A ordem do turno é uma regra

`queue` retira naves da origem imediatamente e guarda a reserva em `orders`.
Cancelar devolve essas naves. `advance` modifica a partida recebida nesta ordem:

1. Obtém todos os planos dos bots antes de aplicar qualquer um deles.
2. Aplica compras e reservas dos bots; transfere as ordens para `fleets`.
3. Incrementa o tick; credita renda, produção e recuperação de defesa.
4. Dispara rotas automáticas com o excedente sobre a reserva.
5. Move as frotas e agrupa as chegadas por estrela.
6. Resolve cada combate com todas as chegadas simultâneas.
7. Completa os observadores dos relatórios, pausa rotas inválidas e verifica vitória.

Essa sequência impede que reforços recém-chegados atravessem várias rotas no mesmo
tick e que uma conquista produza retroativamente. A animação é transitória: no modo
local o resultado já foi salvo quando a viagem começa a aparecer na tela.

## Combate e previsões

`resolveCombat` calcula um resultado sem modificar a estrela recebida. É usado
tanto pelo turno real quanto por `forecastStar`, evitando duas fórmulas divergentes.
Cada lado divide suas naves e defesa igualmente entre os adversários; todos os
pares duelam antes do reagrupamento. Frações são mantidas entre rodadas e somente o
resultado final é arredondado. As baterias absorvem perdas antes das naves.

O planejador copia o estado, desfaz reservas para recuperar a posição confirmada e
aplica a perspectiva do bot. Ele usa previsões para compras, socorro e ataques
coordenados. Perfis diferentes mudam preferências; não concedem recursos extras.

## Como uma sala avança uma única vez

Cada membro possui uma lista privada de ações. `draft` reaplica somente essa lista
em uma cópia do jogo confirmado. Quando todos os humanos ativos estão prontos,
`resolve` cria os planos dos bots e os drafts no mesmo estado inicial, combina as
preparações e chama `advance(g, false)`. O argumento evita planejar os bots novamente.
IDs das frotas são atribuídos novamente ao combinar drafts, pois todos partiram do
mesmo contador antigo.

`accessRoom` grava com `UPDATE ... WHERE revision = ?`. Se outra requisição gravou
primeiro, o servidor relê a sala e revalida a ação. O `requestId` evita repetir uma
ação já aceita; o `tick` esperado impede que uma confirmação atrasada confirme o
turno seguinte. Há no máximo 12 tentativas por chamada. O teste online usa SQLite
em memória, com a mesma migração SQL, para exercitar esse protocolo.

## Compatibilidade que precisa ser preservada

`restoreGame` aceita saves 1, 2 e 3, copia os dados e migra campos ausentes. Ele não
sorteia outro mapa nem recalcula posições ou trajetos antigos. Os testes históricos
usam `fixtures/legacy-game.mjs` para fixar a geometria; as regras continuam vindo do
motor atual. `multiplayer-test.mjs` testa vários impérios locais;
`online-test.mjs` testa identidades e confirmações entre humanos.

Para uma mudança nas regras, comece por [desenvolvimento e testes](development.md).
