# Spec: Encerramento automatico por inatividade no chat — V1

Status: implementado

## Objetivo

Se o usuario ficar inativo por mais de **5 minutos** durante um chat em
andamento, o atendimento e encerrado automaticamente e a tela volta para a
aba inicial (escolha de perfil, `mensagens` vazio + `perfil` null).

Comportamento detalhado:

- **Aviso aos 4 minutos:** quando o tempo de inatividade atingir 4 minutos,
  um aviso visivel aparece na tela indicando que o chat sera encerrado por
  inatividade. O aviso exibe a contagem regressiva dos segundos restantes
  (de 60 ate 0) ate o encerramento.
- **Reset por qualquer interacao:** um clique/toque, tecla pressionada ou
  scroll em qualquer parte da tela reseta a contagem. O chat permanece
  aberto e o aviso some; a contagem recomeca do zero (o aviso so volta a
  aparecer apos novos 4 minutos de inatividade).
- **Atividade da agente tambem conta:** qualquer processo da Nori visivel
  na interface reseta a contagem — streaming de tokens (atualizacao de
  `mensagens`), etapas de tool (`etapaStream`), estado `enviando` e
  reproducao de audio (`tocandoId`). Regra do usuario: "quando tiver
  ativo o timer fica em 0; so dispara quando nada acontecer na tela".
- **Encerramento aos 5 minutos:** equivale ao fluxo de "encerrar
  atendimento" ja existente (`encerrarAtendimento` em
  `frontend/src/App.tsx`): chama `encerrarCaso(cid)` na API, marca a
  conversa como `encerrada` no historico (card de encerrado fica salvo),
  limpa perfil/mensagens e mostra a tela inicial. Nao ha contagem de 3s
  de `encerrandoEm` — o encerramento por inatividade e imediato (o aviso
  de 1 minuto ja funcionou como aviso previo).

## Decisoes (confirmadas com o usuario)

- Fechar o chat **encerra o caso via API** (`encerrarCaso`), nao apenas
  abre uma conversa nova.
- **Qualquer interacao** conta como atividade (clique, teclado, scroll,
  toque) e reseta o contador.
- O timer **pausa/zera enquanto `enviando` e true** e enquanto houver
  atividade visivel da agente (stream de tokens, tools, TTS) — evita
  fechar no meio de um processo em andamento.

## Escopo do timer

- O timer so roda quando ha um chat em andamento: `mensagens.length > 0`
  ou `enviando`. Conversa vazia na tela inicial nao dispara encerramento
  (nao ha caso para encerrar).
- Ao selecionar outra conversa do historico ou iniciar `novaConversa`, a
  contagem recomeca (ultima atividade = momento da troca/abertura).
- Interacoes contam mesmo fora da janela do chat (sidebar, header,
  botoes) — "qualquer lugar da tela".
- **Mobile:** nao ha teclado fisico — todo input e touch. Os listeners
  usam `pointerdown` (cobre mouse, touch e caneta nos navegadores
  modernos) + `touchstart`/`touchmove` como fallback, alem de `keydown`
  (desktop) e `scroll`/`wheel` (passive). Nenhuma interacao depende de
  teclado.

## Implementacao prevista

- `frontend/src/App.tsx`:
  - `useRef` com timestamp da ultima atividade + `useEffect` com
    listeners globais: `pointerdown`, `touchstart`, `touchmove`,
    `keydown`, `wheel`, `scroll` (todos `passive: true` onde possivel)
    em `window`/`document` — cada evento atualiza `lastActivity`.
  - `useEffect` separado observando sinais de atividade da agente:
    `[mensagens, etapaStream, enviando, tocandoId]` — qualquer mudanca
    visivel atualiza `lastActivity`. Como `mensagens` muda a cada token
    do stream, uma resposta em andamento mantem o timer em 0.
  - `setInterval` de 1s calculando inatividade = `Date.now() - lastActivity`;
    estado `segundosInativo` para renderizar o banner e disparar o
    encerramento. O proprio tick do relogio NAO pode alimentar
    `lastActivity` (estado separado, sem loop).
  - Inatividade >= 5min → `encerrarAtendimento()` (a condicao de escopo
    — `mensagens.length > 0 || enviando` — se resolve sozinha porque o
    encerramento zera `mensagens`).
  - Pause durante `enviando`: desnecessaria se o efeito de atividade ja
    cobre — `enviando`/tokens atualizam `lastActivity` continuamente.
    Manter o guarda `!enviando` no disparo como cinto de seguranca.
- Banner de aviso: elemento fixo/overlay no chat (estilo do
  `.alerta-api` existente ou banner inferior), texto em PT-BR, ex.:
  "Sua conversa sera encerrada por inatividade em {n} segundos. Clique
  em qualquer lugar para continuar."
- CSS em `frontend/src/styles.css` seguindo o padrao visual existente
  (tema claro/escuro via variaveis).

## Fora de escopo (V2 / nao fazer agora)

- Persistir o timer entre reloads da pagina (sessionStorage) — recarregar
  zera a contagem.
- Aviso sonoro/notificacao push.
- Encerramento diferente por perfil ou por etapa do caso.
- Qualquer mudanca na API/backend — e 100% frontend.

## Criterios de sucesso

- Com chat ativo e sem interacao nem atividade da agente: aos 4min
  aparece o aviso com segundos regressivos; aos 5min a conversa e
  encerrada (API `encerrarCaso` chamada, conversa marcada `encerrada`,
  tela inicial com escolha de perfil).
- Qualquer clique/toque/tecla/scroll reseta o contador e some o aviso —
  inclusive no mobile, onde todo input e touch.
- Enquanto a Nori estiver ativa na tela (stream, tools, audio), o timer
  fica em 0; a contagem so comeca quando a tela ficar totalmente parada.
- `npm run typecheck`, `npm test`, `npm --prefix frontend run build`
  passam.
- `docs/CONTEXTO_ATUAL.md` atualizado; pagina `docs/fluxo-kora/index.html`
  atualizada se a mudanca for considerada visivel ao entrevistador;
  commit + push em `main`.

## Perguntas em aberto

- O aviso deve mostrar a contagem regressiva de segundos ou apenas o
  texto estatico? (Spec assume contagem regressiva — trivial de ajustar.)
- Interacao dentro do proprio banner de aviso conta como reset? (Spec
  assume que sim: qualquer clique reseta, inclusive no banner.)
