# Desenvolvimento e verificação

Use Node.js 24 ou posterior para as suítes, incluindo `node:sqlite`, e Python 3
para servir os arquivos. O motor e seus testes não precisam de pacotes npm.

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory public
node scripts/test.mjs
```

Abra `http://127.0.0.1:4173`. Esse servidor oferece o modo local; não implementa
`/api/rooms`. As salas online usam o servidor da hospedagem existente. O código do
protocolo, o adaptador HTTP e a migração SQL estão disponíveis para leitura e teste;
as ferramentas específicas de implantação não fazem parte da distribuição pública.

## Suítes

| Comando | Cobertura |
| --- | --- |
| `node approved-map-test.mjs` | 896 mapas, espaçamento, ciclos de sorteio e persistência |
| `node test.mjs` | Regras básicas de produção, ordens, conquistas e vitória |
| `node route-test.mjs` | Reservas, encadeamento, ciclos e pausa de rotas |
| `node multiplayer-test.mjs` | Vários impérios locais, planos simultâneos e migração |
| `node combat-defense-test.mjs` | Baterias, custos, perdas e previsões |
| `node duel-test.mjs` | Duelo simultâneo, frações, empate e reagrupamento |
| `node fog-test.mjs` | Visão, frotas ocultas e observadores de batalhas |
| `node bot-profile-test.mjs` | Perfis, decisões observáveis e planejamento sem mutação |
| `node online-test.mjs` | Autorização, drafts privados, concorrência e reconexão em SQLite |
| `node online-usability-test.mjs` | Acessos locais, arquivos de recuperação, nomes e resumos |

`scripts/test.mjs` executa essas dez suítes em processos separados e retorna erro
se qualquer uma falhar. Não altere as expectativas de regras para acomodar uma
mudança de formatação.

## Simulação longa: falha conhecida

`node bot-simulation-test.mjs` tenta terminar onze partidas de oito impérios em até
200 ticks. Na revisão de 05/11/2026, o teste passou a importar o motor depois de
instalar sua semente: o sorteador de mapas captura `Math.random` ao carregar o
módulo, e antes os mapas não eram reproduzíveis. Com a semente completa, a quarta
partida, mapa `v1-8-130096`, ultrapassa esse limite. O mesmo resultado ocorre com
o motor anterior à revisão de legibilidade. Isso é uma pendência de
simulação/balanceamento: as regras não prometem término nesse prazo. A asserção de
término foi preservada, sem afrouxar o teste ou recalibrar os bots.

Para incluir essa suíte e receber seu status de falha, execute:

```sh
node scripts/test.mjs --simulation
```

## Navegador

`approved-map-browser-test.cjs` exercita o jogo em 1440, 390 e 360 px, incluindo
recarga, início com 2–8 impérios, combate, melhorias, rotas e save antigo. Requer
Playwright e Chromium; no Windows usa o Microsoft Edge instalado.

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node approved-map-browser-test.cjs
```

Mantenha o servidor estático acima aberto. Capturas ficam em `artifacts/`, ignorado
pelo Git. Os testes online de navegador exigem um servidor com `/api/rooms`; não
os aponte para produção durante uma revisão de código, pois eles criam salas.

## Como propor mudanças

Faça alterações pequenas, descreva a regra afetada e execute a suíte correspondente.
Mudanças de visão ou sala também exigem os testes de névoa e online. Mudanças de
mapa devem preservar o banco aprovado e saves existentes. Pull requests começam
como draft, com comandos executados, resultados e limitações no texto.

Nunca inclua saves reais, arquivos de acesso de jogadores, bancos locais,
credenciais, capturas privadas ou configurações de hospedagem em commits públicos.
