# LBike — Documento de Design

## Intenção e porquê

O utilizador anda de bicicleta em todas as estações e sentiu, repetidamente, a
falta de duas coisas ao sair para pedalar: não ter a atividade registada e não
conseguir planear antecipadamente por onde poderia passar. A Strava resolve
isto, mas tranca as funcionalidades mais úteis atrás de uma assinatura cara.

O LBike nasce como alternativa própria: uma aplicação iOS para registar
pedaladas, corridas e caminhadas, planear rotas num mapa antes de sair, e
partilhar essas atividades com amigos num modelo social aberto, semelhante ao
da Strava. Sem travar funcionalidades atrás de pagamento, e com espaço para o
criador adicionar, no futuro, as inovações que sente faltarem nas apps
existentes.

Prioridade declarada pelo utilizador: ter uma primeira versão a funcionar o
mais depressa possível — ele pedala já, em todas as estações, e quer poder
usar a app nas suas próprias saídas o quanto antes.

## Objetivos (MVP)

1. **Registo de atividades por GPS** — gravar pedaladas, corridas e
   caminhadas: percurso no mapa, distância, duração, ritmo/velocidade e
   desnível (quando disponível, a partir dos sensores do próprio
   dispositivo — ver nota em "Registo de atividades" abaixo). Deve
   funcionar com o ecrã bloqueado e a app em segundo plano.
2. **Planeamento de rotas** — desenhar um percurso num mapa antes de sair,
   à mão, ponto a ponto (sem cálculo automático de caminho por
   estradas/ciclovias — ver secção de Mapas), guardá-lo, e usá-lo como
   referência **visual** durante a atividade (a rota aparece desenhada no
   mapa para comparação; não há alertas ativos de desvio do percurso).
3. **Partilha social, em modelo aberto (estilo Strava)** — perfis públicos,
   seguir/ser seguido, feed de atividades de quem segues, fotos e vídeos
   associados às atividades, kudos (reações) e comentários.

   Esta funcionalidade está dividida em duas leva, para não atrasar a
   primeira versão utilizável:
   - **3a (primeira leva):** perfil público básico, seguir/ser seguido,
     feed de atividades de quem se segue.
   - **3b (logo a seguir):** fotos e vídeos nas atividades, kudos e
     comentários.

## Não-objetivos (fora do MVP, mas no roadmap)

Estas funcionalidades existem na Strava e foram identificadas pelo
utilizador como desejáveis eventualmente, mas ficam deliberadamente fora da
primeira versão para não atrasar o lançamento. Ver secção **Roadmap futuro**
mais abaixo para a lista completa.

## Anti-objetivos (o que seria falhar, mesmo funcionando tecnicamente)

- Entregar uma primeira versão tão ambiciosa que nunca fique pronta —
  o utilizador foi explícito: velocidade até ter algo utilizável é a
  prioridade.
- Depender de um Mac físico para o ciclo diário de desenvolvimento — o
  utilizador não tem um, e isso foi um critério decisivo na escolha da
  stack.
- Introduzir custos de infraestrutura (mapas, APIs externas) desde o
  primeiro dia, quando existe alternativa gratuita suficiente para o MVP.

## Restrições

- O criador é o único programador (full-stack: Laravel, React, Angular),
  sem experiência prévia em Swift/iOS nativo.
- Não possui um Mac. Qualquer stack ou fluxo que exija Xcode local para o
  ciclo normal de desenvolvimento está excluído.
- Existe uma VPS disponível para alojar o backend, mas apenas para uma fase
  posterior — por agora, tudo corre localmente.
- Plataforma alvo: iOS (iPhone). Android não foi pedido nem está em scope.
- O utilizador **ainda não está inscrito no Apple Developer Program**
  (conta paga da Apple). Isto é um bloqueador para instalar o Development
  Client no iPhone físico e, mais tarde, publicar a app — por isso entra
  como a primeira tarefa prática do plano de implementação, visto que a
  verificação de identidade da Apple pode levar de um dia a cerca de uma
  semana.

## Decisões de arquitetura (já tomadas com o utilizador)

### App móvel (iOS)

**React Native com Expo**, usando um *Development Client* próprio compilado
via **EAS Build** (não o Expo Go genérico da loja). Motivo: o utilizador já
conhece React, o que torna a transição natural; permite testar ao vivo no
iPhone físico via Wi-Fi sem Xcode local; e o Expo Go simples não suporta
rastreio de GPS em segundo plano, que é essencial aqui. Builds finais para a
App Store também correm na nuvem via EAS, sem necessidade de Mac.

Alternativas consideradas e rejeitadas:
- **Swift/SwiftUI nativo** — melhor desempenho, mas o ciclo de iteração sem
  Mac tornaria cada teste num build remoto lento. Inviável dado o critério
  de velocidade.
- **Capacitor (app web embrulhado)** — resolveria o acesso a GPS nativo,
  mas corre em WebView, com pior sensação de fluidez em mapas/animações do
  que componentes nativos reais.
- **PWA pura (web)** — rejeitada: o iOS não permite rastreio de localização
  em segundo plano a partir de uma web app, o que inviabiliza a
  funcionalidade central (gravar uma atividade com o ecrã bloqueado).

### Rastreio de localização

`expo-location`, configurado com permissão "always" e modo de atualização em
segundo plano, through o Development Client (ver acima).

### Mapas

**Apple MapKit** (nativo, gratuito e ilimitado), usado tanto para o
planeamento/desenho de rotas como para mostrar o percurso percorrido numa
atividade. Decisão do utilizador, trocando a sugestão inicial (Mapbox) por
esta opção para evitar custos externos numa fase inicial.

O planeamento de rotas é **desenho manual ponto a ponto** (o utilizador
marca o traçado no mapa), não cálculo automático de caminho por
estradas/ciclovias — o suporte do MapKit para rotas de bicicleta é fraco
e um motor de rotas melhor exigiria um serviço externo pago, o que
contrariaria o anti-objetivo de evitar custos de infraestrutura no
arranque. Se no futuro for necessário sugerir rotas automaticamente, ou
funcionalidades como mapas de calor pessoais e perfis de elevação mais
ricos, a migração para Mapbox fica em aberto no roadmap.

### Backend

**Laravel**, como API REST, com **Laravel Sanctum** para autenticação por
token (adequado para consumo por uma app móvel). Motivo: o utilizador já
tem experiência com Laravel, o que acelera o desenvolvimento.

- **Base de dados:** MySQL (opção por omissão do Laravel, caminho mais
  testado). *Chamada do construtor — minoritária; pode trocar-se por
  PostgreSQL sem impacto na arquitetura caso o utilizador prefira.*
- **Autenticação de utilizador:** registo por email/password para o MVP.
  *Chamada do construtor — evita, por agora, a obrigação da Apple de
  oferecer "Sign in with Apple" sempre que há login social de terceiros
  (Google/Facebook); essas opções ficam para mais tarde, quando fizer
  sentido adicioná-las.*
- **Armazenamento de ficheiros (fotos/vídeos):** disco local durante o
  desenvolvimento; migração para S3 ou Cloudflare R2 quando a app for para
  a VPS em produção.
- **Processamento em segundo plano** (ex.: gerar miniaturas de vídeo,
  processar importações de GPX no futuro): Laravel Queues.

### Ambiente de desenvolvimento

Tudo corre localmente por agora (backend Laravel na máquina do utilizador,
app testada no iPhone físico via Expo). A VPS existente entra em jogo
apenas quando o utilizador decidir avançar para produção/domínio público.

## O que fica por decidir pelo construtor

- Modelagem exata das tabelas (atividades, rotas, seguidores, kudos,
  comentários, media) — segue convenções Laravel/Eloquent standard.
- Estrutura de pastas e organização do código React Native/Expo.
- Escolha entre MySQL e PostgreSQL, se o utilizador quiser revisitar.
- Design visual exato das telas (cores, componentes) — a inspiração
  funcional é a Strava, mas o visual fica à descrição do construtor dentro
  do senso comum de apps de fitness.
- Estratégia de testes automatizados a adotar.
- **Origem do desnível (elevação):** calculado a partir dos sensores do
  próprio dispositivo (altímetro/barómetro e altitude do GPS), sem recurso
  a uma API externa de elevação. *Chamada do construtor* — consistente com
  o anti-objetivo de não introduzir custos de infraestrutura no arranque;
  o valor pode ser menos preciso que o de serviços dedicados, mas é
  suficiente para o MVP.

## Roadmap futuro (explicitamente fora do MVP)

Registado para não se perder, com base no levantamento de funcionalidades
da Strava feito pelo utilizador. Sem ordem de prioridade definida ainda —
a definir quando o MVP estiver estável.

- **Estatísticas e análise avançada:** recordes pessoais, ritmo ajustado à
  inclinação (GAP), potência, zonas de treino, Fitness & Freshness,
  Relative Effort, estatísticas cumulativas e comparação de atividades no
  mesmo percurso.
- **Rotas e exploração:** rotas sugeridas por localização, mapas de calor
  pessoais, mapas offline, exportação de rotas em GPX/TCX (migração
  provável para Mapbox para suportar estas funcionalidades).
- **Segmentos e competição:** segmentos definidos pela comunidade,
  classificações (KOM/QOM/CR), Live Segments, classificações filtradas.
- **Objetivos e planeamento de treino:** metas semanais/mensais/anuais,
  planos de treino guiados.
- **Comunidade:** clubes, desafios individuais e de grupo, atividades de
  grupo, Flyby (ver atletas que passaram por percursos semelhantes).
- **Segurança:** partilha de localização em tempo real com contactos de
  confiança (equivalente ao Strava Beacon), controlos de privacidade de
  mapa (ocultar início/fim).
- **Equipamento:** registo de bicicletas/sapatilhas, quilometragem
  acumulada por equipamento.
- **Integrações:** importação/sincronização com dispositivos e sensores
  (frequência cardíaca, potência, relógios desportivos), dados
  meteorológicos na atividade.
- **Conta e dados:** exportação de dados pessoais, gestão fina de
  privacidade por atividade.
- **Login social** (Google/Apple/Facebook) — avaliar nessa altura a
  exigência da Apple de incluir "Sign in with Apple".
- **Android** — não pedido, mas o React Native deixa essa porta aberta se
  o utilizador quiser expandir a plataforma no futuro.
