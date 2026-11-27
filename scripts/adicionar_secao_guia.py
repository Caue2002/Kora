# Acrescenta secao 09 ao Guia de Entrevista (apenas insercao; nao altera texto existente).
# Estilo replicado das paginas existentes: banda de secao slate, tabela navy/slate,
# helv/hebo (Latin-1 only — travessao do rodape e desenhado como traco vetorial).
import fitz

PDF = r'C:\Users\caue\Downloads\Guia Técnico de Entrevista — Projeto Kora & Agente Nori.pdf'

NAVY = (0.0588, 0.0902, 0.1647)      # 0f172a
ORANGE = (0.9176, 0.3451, 0.0471)   # ea580c
BODY = (0.1176, 0.1608, 0.2314)      # 1e293b
GRAY = (0.3922, 0.4549, 0.5451)      # 64748b
WHITE = (1, 1, 1)
BORDER = (0.7961, 0.8353, 0.8824)    # cbd5e1
SLATE = (0.9451, 0.9608, 0.9765)      # f1f5f9
ALT = (0.9725, 0.9804, 0.9882)        # f8fafc

X0, X1 = 51.0, 544.5
COL1_X, COL2_X, COL2_W = 58.0, 186.0, 354.0

doc = fitz.open(PDF)

# ---------- 1) corrige "of 5" -> "of 6" nos rodapes das 5 paginas ----------
for pno in range(5):
    page = doc[pno]
    rd = page.get_text('rawdict')
    last5 = None
    for b in rd['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                chars = s.get('chars', [])
                txt = ''.join(c['c'] for c in chars)
                if txt.startswith('Page ') and ' of ' in txt:
                    for c in chars:
                        if c['c'] == '5':
                            last5 = c
    if last5 is None:
        print(f'pagina {pno+1}: rodape nao achado')
        continue
    r = fitz.Rect(last5['bbox'])
    page.add_redact_annot(r + (-0.6, -0.6, 0.6, 0.6))
    page.apply_redactions()
    page.insert_text(fitz.Point(last5['origin']), '6',
                     fontname='helv', fontsize=8.5, color=GRAY)
    print(f'pagina {pno+1}: rodape atualizado')

# ---------- 2) nova pagina 6 ----------
if doc.page_count == 6:
    doc.delete_page(5)  # refaz a pagina se o script rodar de novo
page = doc.new_page(width=595, height=842)

def wrap_text(text, width, font, size):
    words = text.split(' ')
    lines, cur = [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if fitz.get_text_length(t, font, size) <= width:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

ROWS = [
    ('Busca Lexical (Fallback)',
     "Embedding transforma texto em vetor por SIGNIFICADO ('comida fria' acha 'temperatura "
     "inadequada'); lexical e a busca por PALAVRA EXATA no banco (ILIKE). Se a API de embeddings "
     "falha - cota zerada ou timeout - a busca degrada para lexical e segue achando palavras-chave: "
     "foi o que manteve o eval de retrieval em 18/18 durante a falta de cota diaria. Se os dois "
     "falharem, a busca volta vazia e a Nori responde sem base, nunca inventa."),
    ('Function Calling por Dentro',
     "As tools (consultar_pedido, buscar_politica) executam LOCALMENTE no servidor - o modelo so "
     "decide QUANDO chamar e nunca acessa o banco direto. O loop repete ate MAX_TOOL_ROUNDS; na "
     "ultima rodada as tools sao removidas do payload para forcar resposta em texto, senao ele "
     "poderia consultar para sempre sem responder. Chamadas nao emitem texto: o usuario ve "
     "'Consultando pedido...' e o stream so comeca na resposta final."),
    ('Por que hit@4',
     "O LLM so recebe os top-K trechos da busca dentro do prompt: regra certa fora do top-K = "
     "resposta sem base ou alucinada. hit@4 mede a busca ISOLADAMENTE, sem gastar tokens de "
     "geracao - das 18 perguntas com gabarito, em quantas a politica certa apareceu nos 4 "
     "primeiros resultados? Hoje 18/18. Sem essa metrica, busca ruim so apareceria como resposta "
     "errada, dificil de atribuir a causa."),
    ('Cotas por Modelo',
     "O free tier do Gemini e cobrado POR MODELO: estourar a cota do principal nao afeta o lite. "
     "Cada slot do catalogo tem id de cota proprio e a marca de esgotado expira na virada da "
     "janela (minuto/hora/dia). Bug real que originou isso: slots compartilhando id faziam um "
     "unico 429 derrubar varios modelos juntos - hoje cada slot tem cota independente."),
    ('Stream que Morre no Meio',
     "O servidor le o PRIMEIRO chunk do stream antes de responder: stream que abre os headers e "
     "morre sem emitir byte aciona o proximo modelo da fila, invisivel ao usuario. O texto "
     "acumulado alimenta cache, historico e metricas. No frontend, falha transitoria na primeira "
     "tentativa dispara retry silencioso (~1.2s) limpando o stream parcial antes de mostrar erro."),
    ('Flake vs Regressao Real',
     "O juiz LLM varia entre rodadas (mesmo prompt, notas diferentes) - eval dele e probabilistico. "
     "O baseline no CI compara com o MELHOR run anterior e so reprova queda acima de 10pp: "
     "oscilacao pequena passa, regressao real bloqueia o build. Regra pratica: confie nos evals "
     "deterministicos (rubricas, retrieval) e leia a justificativa do juiz antes de culpar o "
     "codigo."),
]

INTRO = ("Estes sao os follow-ups que o entrevistador usa para testar se voce ENTENDE o sistema ou "
         "so decorou a cola rapida. Regra de ouro: responda sempre com um episodio real - "
         "'na pratica, quando a cota de embeddings zerou, o fallback lexical manteve o retrieval "
         "em 18/18' convence mais que qualquer definicao.")

TIP_LABEL = 'DICA DE OURO: '
TIP_TEXT = ("Nesses detalhes, responda com um episodio vivido seu - 'a cota de embeddings zerou e "
            "o fallback lexical manteve os evals em 18/18' - em vez de recitar definicao. Historia "
            "real prova que voce debugou producao, nao so leu documentacao.")

LEAD = 12.4
PAD_TOP, PAD_BOT = 6.0, 8.0
row_heights = []
for label, desc in ROWS:
    lines = wrap_text(desc, COL2_W, 'helv', 9.2)
    h = PAD_TOP + len(lines) * LEAD + PAD_BOT
    row_heights.append(h)
    print(f'  {label}: {len(lines)} linhas -> {h:.0f}px')

# ---- banda de secao ----
page.draw_rect(fitz.Rect(X0, 61, X1, 85), fill=SLATE, color=BORDER, width=0.75)
page.insert_text((61, 76), '09', fontname='hebo', fontsize=12, color=ORANGE)
page.insert_text((78, 76), ' Detalhes que o Entrevistador Pode Cavar (Por Dentro do Sistema)',
                 fontname='hebo', fontsize=12, color=NAVY)

# ---- introducao ----
y = 92.0
for ln in wrap_text(INTRO, X1 - X0 - 4, 'helv', 10):
    page.insert_text((X0, y + 9.5), ln, fontname='helv', fontsize=10, color=BODY)
    y += 13.4

# ---- cabecalho da tabela ----
ty = max(y + 16, 178.0)
header_h = 21.0
page.draw_rect(fitz.Rect(X0, ty, X1, ty + header_h), fill=NAVY, color=NAVY)
page.insert_text((COL1_X - 1, ty + 14), 'CONCEITO', fontname='hebo', fontsize=8.8, color=WHITE)
page.insert_text((COL2_X - 2, ty + 14), 'O QUE ACONTECE POR DENTRO & POR QUE IMPORTA',
                 fontname='hebo', fontsize=8.8, color=WHITE)
ty += header_h

# ---- linhas da tabela ----
for i, (label, desc) in enumerate(ROWS):
    h = row_heights[i]
    rect = fitz.Rect(X0, ty, X1, ty + h)
    if (i + 1) % 2 == 0:
        page.draw_rect(rect, fill=ALT, color=BORDER, width=0.75)
    else:
        page.draw_rect(rect, color=BORDER, width=0.75)
    page.insert_text((COL1_X - 1, ty + PAD_TOP + 8.5), label,
                     fontname='hebo', fontsize=9.2, color=NAVY)
    ly = ty + PAD_TOP + 8.0
    for ln in wrap_text(desc, COL2_W, 'helv', 9.2):
        page.insert_text((COL2_X, ly), ln, fontname='helv', fontsize=9.2, color=BODY)
        ly += LEAD
    ty += h

table_bottom = ty
print(f'tabela termina em y={table_bottom:.0f}')

# ---- faixa de dica ----
tip_label_w = fitz.get_text_length(TIP_LABEL, 'hebo', 9.2)
tip_lines = wrap_text(TIP_TEXT, X1 - X0 - 4 - tip_label_w, 'helv', 9.2)
tip_h = PAD_TOP + max(len(tip_lines), 1) * LEAD + PAD_BOT + 2
ty2 = table_bottom + 18
page.draw_rect(fitz.Rect(X0, ty2, X1, ty2 + tip_h), fill=SLATE, color=BORDER, width=0.75)
base = ty2 + PAD_TOP + 8.5
page.insert_text((X0 + 7, base), TIP_LABEL, fontname='hebo', fontsize=9.2, color=NAVY)
tx = X0 + 7 + tip_label_w
ty3 = ty2 + PAD_TOP + 2
for ln in tip_lines:
    page.insert_text((tx, ty3 + 8.5), ln, fontname='helv', fontsize=9.2, color=BODY)
    ty3 += LEAD
print(f'dica termina em y={ty2 + tip_h:.0f}')

# ---- rodape (travessoes desenhados como tracos vetoriais) ----
FB = 805.5  # baseline do rodape (igual as paginas existentes)
DASH_W = 8.0
segs = ['Guia de Estudo ', ' Projeto Kora & Agente Nori ', ' Arquitetura GenAI']
x = X0
for i, seg in enumerate(segs):
    page.insert_text((x, FB), seg, fontname='helv', fontsize=8.5, color=GRAY)
    x += fitz.get_text_length(seg, 'helv', 8.5)
    if i < len(segs) - 1:
        page.draw_rect(fitz.Rect(x + 0.5, FB - 3.4, x + 0.5 + DASH_W, FB - 2.1),
                       fill=GRAY)
        x += DASH_W + 1.0
page.draw_line((X0, 785), (X1, 785), color=BORDER, width=0.75)
right = 'Page 6 of 6'
rw = fitz.get_text_length(right, 'helv', 8.5)
page.insert_text((X1 - rw, FB), right, fontname='helv', fontsize=8.5, color=GRAY)

doc.saveIncr()
print('salvo')
