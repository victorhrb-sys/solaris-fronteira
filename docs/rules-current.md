# Regras atuais

Uma partida tem 2–8 impérios e nove estrelas por participante. Cada império começa
com uma estrela, 54 naves, 60 créditos, economia 3, estaleiro 3 e defesa zero.
Vence quem controla pelo menos metade das estrelas, arredondada para cima.
Dois impérios alcançando a meta no mesmo tick empatam.

| Sistema | Regra |
| --- | --- |
| Economia | 3 créditos por nível por tick; compra custa 20 × próximo nível |
| Estaleiro | 2 naves por nível por tick; compra custa 24 × próximo nível |
| Defesa | 5 pontos por nível; compra custa 15 × próximo nível; recupera até 2 pontos por tick |
| Alcance e visão | 340 UA; apenas estrelas próprias fornecem visão |
| Viagem | Pelo menos um tick; arredonda distância / 190 para cima |
| Rotas automáticas | Enviam o excedente da reserva após a produção; ciclos são rejeitados |

Estrelas neutras não produzem. Conquistar preserva economia e estaleiro, destrói as
baterias e começa a gerar recursos no próximo tick. Perder uma ponta de uma rota
pausa seu funcionamento; reconquistar não a retoma automaticamente.

As chegadas do mesmo tick são agregadas por império. Com vários lados, cada um
divide sua força entre os adversários e luta em duelos simultâneos. Em cada par,
a maior parcela conserva `M - m² / M`; parcelas iguais se destroem. Os sobreviventes
se reagrupam e repetem até restar um lado ou nenhum. O cálculo só arredonda ao final.
Sem sobreviventes, o controle anterior permanece.

No modo local, um humano enfrenta 1–7 bots. No online, pelo menos dois humanos
entram por convite e o restante das vagas vira bot ao iniciar. Todos os humanos
ativos precisam confirmar para avançar. Não existe prazo automático de turno.
Desconectar preserva o lugar; entregar o império ao bot é definitivo.

Os 896 mapas formam sete bancos de 128. Novas partidas usam as escalas calibradas;
saves antigos preservam suas coordenadas. Os 81 perfis de bots não representam
uma garantia de equilíbrio entre estratégias ou de término em 200 turnos.
