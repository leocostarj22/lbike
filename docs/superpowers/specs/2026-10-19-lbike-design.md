# LBike — Documento de Design

> **Nota de revisão (2026-10-20):** este documento foi atualizado para
> refletir uma mudança de arquitetura do frontend — de app nativa React
> Native/Expo para **PWA instalável** (React + Vite). O motivo e as
> implicações estão na secção "Decisões de arquitetura" abaixo. O backend
> (Laravel) e os objetivos de produto mantêm-se; o que muda é como o
> cliente é construído e distribuído.

## Intenção e porquê

O utilizador anda de bicicleta em todas as estações e sentiu, repetidamente, a
falta de duas coisas ao sair para pedalar: não ter a atividade registada e não
conseguir planear antecipadamente por onde poderia passar. A Strava resolve
isto, mas tranca as funcionalidades mais úteis atrás de uma assinatura cara.

O LBike nasce como alternativa própria: uma aplicação para registar
pedaladas, corridas e caminhadas, planear rotas num mapa antes de sair, e
partilhar essas atividades com amigos num modelo social aberto, semelhante ao
da Strava. Sem travar funcionalidades atrás de pagamento, e com espaço para o
criador adicionar, no futuro, as inovações que sente faltarem nas apps
existentes.

Prioridade declarada pelo utilizador: ter uma primeira versão a funcionar o
mais depressa possível — ele pedala já, em todas as estações, e quer poder
usar a app nas suas próprias saídas o quanto antes. Esta prioridade foi, em
2026-10-20, a razão direta para a mudança de arquitetura descrita abaixo: duas
sessões de trabalho foram consumidas por fricção específica de distribuição
de apps nativas iOS (conta paga da Apple, incompatibilidade de versão do Expo
Go, autenticação de túneis) sem ainda se conseguir testar no dispositivo
físico.

## Objetivos (MVP)

1. **Registo de atividades por GPS** — gravar pedaladas, corridas e
   caminhadas: percurso no mapa, distância, duração, ritmo/velocidade e
   desnível (quando disponível, a partir dos dados de altitude do próprio
   GPS do dispositivo — ver nota em "Registo de atividades" abaixo).
   Funciona com o ecrã ligado durante o registo (ver limitação de PWA na
   secção de arquitetura); não é garantido com o ecrã bloqueado.
2. **Planeamento de rotas** — desenhar um percurso num mapa antes de sair,
   à mão, ponto a ponto (sem cálculo automático de caminho por
   estradas/ciclovias — ver secção de Mapas), calcular a distância total a
   partir dos pontos marcados, guardá-lo, e usá-lo como referência
   **visual** durante a atividade (a rota aparece desenhada no mapa para
   comparação; não há alertas ativos de desvio do percurso).
3. **Partilha social, em modelo aberto (estilo Strava)** — perfis públicos,
   seguir/ser seguido, feed de atividades de quem segues, fotos e vídeos
   associados às atividades, kudos (reações) e comentários.

   Esta funcionalidade está dividida em duas levas, para não atrasar a
   primeira versão utilizável:
   - **3a (primeira leva):** perfil público básico, seguir/ser seguido,
     pedidos de seguimento para perfis privados, bloquear/desbloquear
     utilizadores, feed de atividades de quem se segue, visibilidade por
     atividade (pública/seguidores/privada).
   - **3b (logo a seguir):** fotos e vídeos nas atividades, kudos e
     comentários.
4. **Instalável no telemóvel (PWA)** — manifesto válido, ícones, e
   experiência de instalação no ecrã principal em iOS e Android, sem loja
   de aplicações.

## Não-objetivos (fora do MVP, mas no roadmap)

Estas funcionalidades existem na Strava e foram identificadas pelo
utilizador como desejáveis eventualmente, mas ficam deliberadamente fora da
primeira versão para não atrasar o lançamento. Ver secção **Roadmap futuro**
mais abaixo para a lista completa.

## Anti-objetivos (o que seria falhar, mesmo funcionando tecnicamente)

- Entregar uma primeira versão tão ambiciosa que nunca fique pronta —
  o utilizador foi explícito: velocidade até ter algo utilizável é a
  prioridade.
- Depender de um Mac físico, de Xcode, ou de uma conta paga de
  programador (Apple/Google) para o ciclo diário de desenvolvimento ou
  para o utilizador conseguir instalar a app no seu próprio telemóvel.
- Introduzir custos de infraestrutura (mapas, APIs externas) desde o
  primeiro dia, quando existe alternativa gratuita suficiente para o MVP.
- Prometer funcionalidade (ex.: rastreio em segundo plano, modo offline
  completo) que não foi de facto implementada e testada num dispositivo
  real.

## Restrições

- O criador é o único programador (full-stack: Laravel, React, Angular),
  sem experiência prévia em Swift/iOS nativo — já não é relevante como
  bloqueio, dado que a stack escolhida não exige nenhum dos dois.
- Existe uma VPS disponível para alojar o backend, mas **ainda sem
  domínio nem HTTPS/proxy reverso configurados** (confirmado em
  2026-10-20). Até isso estar pronto, o desenvolvimento e os testes no
  telemóvel continuam via túnel Cloudflare local (ver "Ambiente de
  desenvolvimento").
- Plataformas alvo: iOS e Android (o PWA instala em ambos sem trabalho
  extra — ver Roadmap). Android nunca foi pedido explicitamente, mas deixa
  de ter custo adicional de suporte.
- **Já não há bloqueio por conta de programador paga.** A necessidade de
  inscrição no Apple Developer Program, que bloqueou a app nativa durante
  dias, deixa de existir: uma PWA instala-se via Safari sem assinatura,
  sem revisão de loja e sem build nativo.

## Decisões de arquitetura (já tomadas com o utilizador)

### Frontend: PWA (mudança de 2026-10-20)

**React + TypeScript + Vite + Tailwind CSS**, com um componente de UI
reutilizável (ex.: shadcn/ui, por ser a opção mais comum nesta combinação e
não exigir conta/chave externa), e **PWA instalável** via
`vite-plugin-pwa` (manifesto, ícones, service worker).

Motivo da mudança face à decisão original (React Native + Expo + EAS): o
utilizador já conhece React, o que torna a transição natural; e, ao
contrário da app nativa, uma PWA **não depende de loja de aplicações, de
build nativo assinado, nem de conta de programador paga** — instala-se
diretamente a partir do browser (Safari no iOS, Chrome no Android),
eliminando de uma vez o conjunto de bloqueios que consumiu as duas sessões
anteriores (Apple Developer Program pendente, incompatibilidade de SDK do
Expo Go com a versão publicada na App Store, autenticação de túnel do
ngrok).

**Trade-off aceite conscientemente:** o Geolocation API do browser **pode
pausar ou tornar-se instável quando o ecrã bloqueia ou o browser vai para
segundo plano** — isto é uma limitação de plataforma (iOS em particular é
restritivo com processos em segundo plano em web apps), não uma falha de
implementação. Mitigações adotadas para o MVP:
- **Wake Lock API** para manter o ecrã ligado durante o registo ativo de
  uma atividade (compromisso aceitável: mais consumo de bateria durante o
  registo, em troca de fiabilidade do rastreio). Confirmado com o
  utilizador (2026-10-20): o dispositivo de teste corre iOS 27, muito
  acima do mínimo (iOS 16.4) para suporte fiável desta API no Safari.
- Documentar claramente esta limitação na própria app (não prometer
  rastreio em segundo plano que não foi testado).
- **Via de escape já identificada, não implementada agora:** se esta
  limitação se revelar um bloqueio real no uso prático, o mesmo código
  React pode ser embrulhado com **Capacitor** para obter acesso a GPS
  nativo em segundo plano, sem reescrever a aplicação do zero — fica
  registado no Roadmap futuro.

Alternativas consideradas:
- **React Native + Expo (decisão anterior, revertida em 2026-10-20)** —
  funcionalmente superior para GPS em segundo plano, mas o custo de
  distribuição (conta paga da Apple, builds EAS, versões do Expo Go) foi
  incompatível com a prioridade de velocidade declarada pelo utilizador.
  O trabalho de backend feito até aqui (Laravel + Sanctum) mantém-se
  totalmente; o código do cliente React Native é descontinuado.
- **Swift/SwiftUI nativo** — rejeitado nas duas rondas de decisão: exige
  Mac/Xcode para o ciclo normal de desenvolvimento.
- **Capacitor desde já** — equilíbrio entre as duas anteriores, mas
  adiado: a app web pura é suficiente para o MVP e mais simples de
  iterar; Capacitor fica como opção de upgrade incremental, não como
  ponto de partida.

### Identidade visual e navegação

Decisões já tomadas (fornecidas pelo utilizador):

- Base escura (cinza-carvão) com superfícies claras e um acento verde-lima
  vivo, mantendo bom contraste; suporte a tema claro e escuro onde
  prático.
- Tipografia de alta qualidade, cartões arredondados, espaçamento
  consistente, animações suaves mas discretas.
- Unidades: quilómetros, metros, km/h, min/km.
- **Todo o texto visível em português europeu** (navegação, botões,
  mensagens de validação, notificações, estados vazios), com formatos de
  data e número adequados.
- Nome do produto: **LBike** (mantém-se; não adotar nomes genéricos de
  template).
- Navegação móvel: barra fixa inferior com cinco secções — **Início,
  Mapa, Registar, Actividades, Perfil** — com "Registar" visualmente
  destacado por ser a ação usada a meio do esforço físico. Em ecrã
  largo (desktop), adaptar para barra lateral ou horizontal equivalente.

### Rastreio de localização

**Geolocation API do browser** (`navigator.geolocation.watchPosition`),
com gestão explícita de permissão e dos estados de erro/precisão
insuficiente. Ver limitação de segundo plano e mitigação (Wake Lock) na
secção anterior.

Guardar coordenadas GPS com timestamp ao longo da sessão de registo;
aplicar filtragem básica para reduzir pontos duplicados e saltos
claramente inválidos, sem descartar secções válidas do percurso nem
inventar coordenadas em falta. Persistir o estado do registo e os pontos
localmente (ex.: IndexedDB/localStorage) durante a sessão, para
sobreviver a navegação acidental dentro da app, e sincronizar com o
backend quando a atividade é terminada.

### Mapas

**MapLibre GL JS**, com tiles vetoriais gratuitos (ex.: OpenFreeMap, sem
chave de API nem limite de utilização) — mantém o anti-objetivo de evitar
custos de infraestrutura no arranque, com melhor qualidade visual (zoom
suave, estilo vetorial) do que tiles raster simples. *Chamada do
construtor — Leaflet é alternativa mais simples se MapLibre se revelar
complexo de mais; a decisão pode ser revista sem impacto noutras partes
do sistema.*

O planeamento de rotas mantém-se **desenho manual ponto a ponto** (o
utilizador marca o traçado no mapa, a distância total é calculada a
partir dos pontos), não cálculo automático de caminho por
estradas/ciclovias — decisão já tomada anteriormente e que se mantém:
um motor de rotas de qualidade para bicicleta exigiria um serviço
externo pago, o que contrariaria o anti-objetivo de evitar custos de
infraestrutura no arranque. Fica no roadmap (ver abaixo) a introdução
futura de um serviço de rotas real (ex.: OpenRouteService, com proxy
pelo backend para não expor a chave).

### Modelo de privacidade e bloqueio (3a)

*Chamadas do construtor* — padrão comum a apps sociais semelhantes,
registado aqui para não ficar ambíguo na camada de autorização:

- **Perfil privado é um teto, não uma exceção:** se o perfil é privado,
  nenhuma atividade sua pode ser mais visível do que "seguidores" — a
  opção "pública" por atividade fica indisponível nesse caso. Isto evita
  que uma atividade "pública" contradiga um perfil privado.
- **Visibilidade é avaliada no momento de visualização, não "congelada"
  na publicação:** se alguém deixa de seguir (ou é removido), deixa de
  ver de imediato as atividades "seguidores"; se um pedido de seguimento
  é aceite, passa a ver essas atividades a partir desse momento — sem
  necessidade de lógica retroativa especial.
- **Bloquear é mútuo e revoga o seguimento em ambos os sentidos:**
  bloquear alguém remove automaticamente qualquer relação de seguimento
  existente entre as duas contas (nos dois sentidos), esconde o perfil e
  atividades do bloqueado para o bloqueador e vice-versa, e impede novos
  pedidos de seguimento enquanto o bloqueio existir.

### Backend

**Mantém-se Laravel**, como API REST, com **Laravel Sanctum** para
autenticação por token — já implementado e testado (registo, login,
`/me`, logout). Esta decisão não é afetada pela mudança de frontend.

- **Base de dados:** MySQL.
- **Autorização e proteção de dados privados:** em vez de Row Level
  Security (específico do Postgres/Supabase), usar **Policies e Gates do
  Laravel** aplicadas em cada endpoint — equivalente funcional: o
  utilizador só pode criar, ver, editar ou apagar recursos que lhe
  pertencem ou que lhe foram tornados visíveis, verificado na camada da
  aplicação em cada pedido, nunca apenas escondido no frontend.
- **Autenticação de utilizador:** registo por email/password para o MVP.
  Login social (Google/Apple) fica no roadmap.
- **Armazenamento de ficheiros (fotos/vídeos):** disco local durante o
  desenvolvimento; migração para S3 ou Cloudflare R2 quando a app for
  para a VPS em produção. URLs assinadas/temporárias para media privada.
- **Processamento em segundo plano** (ex.: gerar miniaturas, processar
  importações de GPX no futuro): Laravel Queues.

### Ambiente de desenvolvimento

Backend Laravel corre localmente, exposto por um túnel Cloudflare (já
configurado e testado) para permitir testar a partir do telemóvel físico
sem precisar de rede local partilhada. O frontend (Vite) corre também
localmente durante o desenvolvimento; abre-se diretamente no browser do
telemóvel através do mesmo tipo de túnel.

**Estado atual da VPS (confirmado com o utilizador em 2026-10-20): ainda
sem domínio apontado nem HTTPS/proxy reverso configurados.** Por isso, o
deploy antecipado para a VPS **não** é assumido como caminho do MVP — fica
como tarefa a preparar cedo (domínio, certificado TLS, proxy reverso)
assim que o primeiro fluxo ponta-a-ponta estiver estável localmente, mas
não bloqueia o arranque do desenvolvimento. Até lá, o ciclo local +
túnel Cloudflare é o caminho de teste válido. Nota: um PWA só regista o
service worker e é instalável num "contexto seguro" (HTTPS, ou
`localhost`) — um túnel Cloudflare serve HTTPS automaticamente, por isso
isto não bloqueia testar a instalação via túnel antes da VPS estar
pronta.

## O que fica por decidir pelo construtor

- Modelagem exata das tabelas (atividades, rotas, seguidores, kudos,
  comentários, media, bloqueios) — segue convenções Laravel/Eloquent
  standard.
- Estrutura de pastas e organização do código React/Vite.
- Escolha entre MapLibre e Leaflet, se MapLibre se revelar complexo de
  mais na prática.
- Biblioteca de componentes UI exata (shadcn/ui por omissão).
- **Ícones/manifesto do PWA:** produzir ícones novos alinhados à
  identidade visual (carvão + verde-lima), não reaproveitar os ícones
  genéricos deixados pelo scaffold Expo anterior.
- **Execução do deploy para a VPS:** segue a mesma convenção já em vigor
  neste projeto para o git push — o construtor prepara os
  passos/scripts, mas é o utilizador quem executa a ligação à VPS e o
  deploy em si, nunca o agente diretamente.
- Estratégia de testes automatizados a adotar.
- **Origem do desnível (elevação):** a partir da altitude reportada pelo
  GPS do dispositivo via Geolocation API, sem recurso a uma API externa
  de elevação. *Chamada do construtor* — consistente com o anti-objetivo
  de não introduzir custos de infraestrutura no arranque; a precisão de
  altitude por GPS de browser tende a ser inferior à de um altímetro
  nativo, pelo que este valor deve ser tratado como aproximado e assim
  comunicado na interface.

## Roadmap futuro (explicitamente fora do MVP)

Registado para não se perder, com base no levantamento de funcionalidades
da Strava feito pelo utilizador. Sem ordem de prioridade definida ainda —
a definir quando o MVP estiver estável.

- **Capacitor (rastreio em segundo plano nativo):** se a limitação de GPS
  em segundo plano do PWA se revelar um bloqueio real no uso prático,
  embrulhar o mesmo código React com Capacitor para obter acesso nativo,
  sem reescrever a aplicação.
- **Estatísticas e análise avançada:** recordes pessoais, ritmo ajustado à
  inclinação (GAP), potência, zonas de treino, Fitness & Freshness,
  Relative Effort, estatísticas cumulativas e comparação de atividades no
  mesmo percurso.
- **Rotas e exploração:** serviço de cálculo de rotas real (ex.:
  OpenRouteService), rotas sugeridas por localização, mapas de calor
  pessoais, mapas offline, exportação/importação de rotas em GPX/TCX.
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
- **Conta e dados:** exportação de dados pessoais, apagar conta.
- **Login social** (Google/Apple/Facebook).
