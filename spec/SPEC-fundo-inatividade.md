# Spec: Fundo de Inatividade — V1

Status: implementado

## Objective

Quando o usuario estiver na **tela inicial** (sem conversa ativa — escolha
de perfil ou chat vazio), o fundo de luz animado ("aurora") aparece
imediatamente, sem espera. Fora da tela inicial, o efeito so aparece se o
usuario ficar inativo por mais de 1 minuto no chat, sinalizando que a
conversa esta ociosa. Qualquer interacao do usuario (clique, toque, scroll,
teclado) interrompe o efeito e zera o timer. A excecao e o periodo em que
o sistema esta processando (resposta da Nori em streaming, handoff, tela de
encerramento, TTS): nesse caso o timer fica travado em zero e o efeito nao
aparece.

Usuario: quem usa o chat do Nori e se afasta da tela por um momento.
Sucesso: o fundo "acende" sozinho na tela inicial e, durante a conversa,
apos ~60s de silencio do usuario; "apaga" ao primeiro sinal de atividade,
sem atrapalhar a leitura nem o fluxo de encerramento existente.

## Tech Stack

- React + TypeScript (frontend/, Vite)
- CSS puro em frontend/src/styles.css (sem dependencias novas)
- Estado existente em App.tsx: `enviando`, `handoff`, `encerrandoEm`,
  `tocandoId`; tema via `document.documentElement.dataset.theme`
  ('claro' | 'escuro')

## Comportamento

### Tela inicial: efeito imediato

- "Tela inicial" = estado sem mensagens na conversa atual
  (`mensagens.length === 0`): tela de escolha de perfil e chat vazio com
  chips de sugestao.
- Nesses estados o overlay de aurora fica **sempre visivel** — sem timer,
  sem contagem.
- Ao enviar a primeira mensagem (ou entrar numa conversa existente), o
  overlay sai de cena e o modo "timer de 60s" assume.
- Se o usuario voltar a um estado sem mensagens (ex.: "Novo chat" ou
  encerrar atendimento), a aurora reaparece imediatamente — e novamente a
  tela inicial.
- No mobile nao ha teclado fisico: toda interacao e via toque — coberta
  pelos mesmos listeners (ver abaixo).

### Timer de inatividade

- Janela de inatividade: **60 segundos** sem atividade do usuario.
- Atividade = qualquer sinal de vida na interface:
  - **Toque/clique/toque longo**: `pointerdown` cobre mouse, touch e
    caneta (Pointer Events unificado; `touchstart`/`mousedown` separados
    ficam redundantes — nao usar os tres para evitar disparo duplo);
  - **Scroll**: `scroll` com `{ passive: true, capture: true }` no
    window/document (pega scroll de qualquer container);
  - **Teclado** (desktop): `keydown` — cobre digitacao no input, atajos e
    navegacao; no mobile nao existe e o listener simplesmente nunca
    dispara, sem custo;
  - **Rodar do mouse** (`pointermove`/`mousemove`) conta como atividade —
    opcional mas recomendado: um usuario lendo a tela com o mouse em
    movimento nao deve ser considerado ocioso.
- O timer e medido a partir da ultima atividade registrada.
- Enquanto QUALQUER processamento estiver em andamento, o timer fica
  travado em zero — a inatividade so comeca a contar quando a interface
  estiver completamente ociosa (nada sendo gerado/exibido):
  - `enviando` (request/stream do /api/chat em andamento — inclui o
    momento em que a resposta da Nori esta sendo digitada na tela);
  - `handoff === 'carregando'` (gerando resumo de handoff);
  - `encerrandoEm !== null` (tela "Encerrando..." com contagem);
  - `tocandoId !== null` (TTS da resposta da Nori tocando).
- Quando o processamento termina, o timer recomeca a contar a partir do
  momento em que o usuario ficar livre novamente (processamento em si
  nao conta como atividade nem zera o relogio — apenas pausa).
- Ao atingir 60s, o efeito visual ativa com uma transicao suave de
  entrada (fade + "respiracao" da luz), nao de forma abrupta.
- Qualquer atividade com o efeito ativo desativa-o imediatamente
  (transicao de saida curta, ~300-500ms) e zera o timer.
- A atividade que dispara o proprio envio de mensagem conta normalmente:
  enviar uma mensagem zera o timer e, durante `enviando`, ele fica
  travado em zero.

### Efeito visual (aurora em camadas)

Camadas fixas (`position: fixed; inset: 0; pointer-events: none`) ATRAS do
conteudo do app, com gradientes radiais que se movem lentamente (keyframes
CSS, 15-25s por ciclo, fases defasadas). Ordem do mais escuro ao mais
claro, intercalando preto/azul/branco em camadas:

- **Tema escuro**: preto profundo -> azul escuro -> azul medio -> branco
  suave (brilho difuso, opacidade baixa para nao brigar com o texto).
- **Tema claro**: azul muito claro -> azul medio -> branco -> brilho
  azulado (manter contraste com texto escuro; opacidades baixas).
- As camadas usam `data-theme` no `<html>` para alternar paletas via
  variaveis CSS — mesma convencao ja usada em styles.css
  (`[data-theme='escuro']`).
- Intensidade total sutil: o efeito deve ser percebido como "luz ambiente",
  nunca reduzir a legibilidade das mensagens.
- `prefers-reduced-motion`: reduzir/zerar a animacao das camadas (manter
  apenas um gradiente estatico suave ou desligar o efeito).

### Interacao com fluxos existentes

- O fluxo de encerramento por timeout (3 min apos "Podemos encerrar?")
  continua identico: quando `encerrandoEm` entra em cena, o timer de
  inatividade pausa e a tela "Encerrando..." assume — o overlay de
  inatividade nao interfere.
- O overlay e puramente visual (`pointer-events: none`): cliques "atraves"
  dele chegam aos elementos normais e tambem contam como atividade
  (via listener global, nao no overlay).
- Funciona em mobile e desktop; em abas ocultas o timer continua correndo
  (ao voltar, o usuario ja ve o efeito se passou de 60s).

## Commands

```
Dev frontend:  npm run dev:web          (Vite, porta 5173)
Dev API:       npm run dev:api          (porta 3000)
Typecheck:     npm run typecheck
Testes:        npm test
Build:         npm --prefix frontend run build
```

## Project Structure

```
frontend/src/App.tsx    -> estado do timer de inatividade e montagem do overlay
frontend/src/styles.css -> keyframes da aurora, paletas por tema, transicoes
frontend/src/           -> opcional: componente InatividadeFundo.tsx se ficar grande
```

## Code Style

- Comentarios em portugues explicando o que a funcao faz (convencao do repo).
- Estado do timer via `useRef`/`useEffect` (intervalo de 1s ou timestamp +
  rAF/interval); listeners de atividade com `{ passive: true }` e cleanup.
- CSS com variaveis por tema, seguindo o padrao `[data-theme='escuro']` ja
  existente em styles.css.
- Sem novas dependencias.

## Testing Strategy

- `npm run typecheck` limpo e `npm --prefix frontend run build` ok.
- `npm test` existente deve continuar passando (mudanca e so de UI).
- Verificacao manual: na tela inicial o fundo ja aparece; apos enviar a
  primeira mensagem, aguardar 60s sem interagir -> aurora aparece;
  clicar/toque/scroll/tecla -> some e timer zera; enviar mensagem ->
  timer travado em zero ate a resposta terminar; alternar tema
  claro/escuro -> paleta troca. Emulacao mobile (DevTools touch):
  toque em qualquer ponto conta como atividade.

## Boundaries

- Always: rodar typecheck + build antes de commitar; seguir convencao de
  comentarios em portugues; atualizar docs/CONTEXTO_ATUAL.md e a pagina
  fluxo-kora antes do commit.
- Ask first: qualquer mudanca no fluxo de encerramento por timeout ou no
  comportamento do `enviando`.
- Never: adicionar dependencias; alterar o IndicadorCarregando; criar
  spinner/loading alternativo.

## Success Criteria

- [ ] Na tela inicial (sem mensagens) o fundo de aurora aparece
      imediatamente, sem espera.
- [ ] Com conversa ativa, sem atividade por 60s o fundo aparece com
      transicao suave.
- [ ] Clique, toque (mobile), scroll ou tecla zeram o timer e escondem
      o efeito — `pointerdown`/`pointermove` + `scroll` + `keydown`.
- [ ] Durante `enviando`, `handoff='carregando'`, `encerrandoEm` e TTS,
      o timer fica travado em zero (efeito nao acende).
- [ ] Voltando a um estado sem mensagens, a aurora reaparece na hora.
- [ ] Paleta adapta-se aos temas claro/escuro via `data-theme`.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Overlay nao bloqueia cliques (`pointer-events: none`) e nao altera
      nenhum fluxo existente.

## Out of Scope (Deferred)

- Notificacao sonora/toast de inatividade (efeito puramente visual).
- Aumentar o timeout de encerramento automatico (permanece 3 min).
- Pausar/encerrar a conversa por inatividade (efeito e so visual).
- Configuracao de tempo de inatividade pelo usuario.

## Open Questions

- Nenhuma — paleta adaptativa por tema, pausa em qualquer processamento e
  atividade = clique+scroll+teclado foram confirmados com o usuario.
