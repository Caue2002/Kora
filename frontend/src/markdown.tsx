// Renderizador de markdown para as respostas do Nori
// Suporta: paragrafos, negrito/italico/codigo inline, listas, checklist
// clicavel, titulos, citacoes, tabelas, blocos de codigo e linhas horizontais
// Gera elementos React (sem dangerouslySetInnerHTML, sem risco de injecao)

import { useState, type ReactNode } from 'react';

// Remove citacoes numericas [n] do texto (a lista de fontes nao e exibida na tela)
function limparCitacoes(texto: string): string {
  return texto.replace(/\s?\[\d+\]/g, '');
}

// Converte texto inline com **negrito**, *italico* e `codigo` em nos React
function inline(texto: string, chaveBase: string): ReactNode[] {
  const partes = limparCitacoes(texto).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return partes.map((p, i) => {
    const chave = `${chaveBase}-${i}`;
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={chave}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      return <em key={chave}>{p.slice(1, -1)}</em>;
    }
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
      return <code key={chave} className="md-code">{p.slice(1, -1)}</code>;
    }
    return <span key={chave}>{p}</span>;
  });
}

// Item de checklist interativo: o usuario pode marcar/desmarcar
function CheckItem({ texto, marcadoInicial, chave }: { texto: string; marcadoInicial: boolean; chave: string }) {
  const [marcado, setMarcado] = useState(marcadoInicial);
  return (
    <li className={marcado ? 'check-feito' : ''}>
      <button
        type="button"
        className="check-box-btn"
        onClick={() => setMarcado((v) => !v)}
        aria-pressed={marcado}
        aria-label={marcado ? 'Desmarcar item' : 'Marcar item'}
      >
        {marcado ? '☑' : '☐'}
      </button>{' '}
      {inline(texto, chave)}
    </li>
  );
}

type Bloco =
  | { tipo: 'p'; linhas: string[] }
  | { tipo: 'lista'; itens: Array<{ texto: string; ordenado: boolean; check?: boolean; marcado?: boolean }> }
  | { tipo: 'codigo'; linguagem: string; linhas: string[] }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] }
  | { tipo: 'titulo'; nivel: number; texto: string }
  | { tipo: 'citacao'; linhas: string[] }
  | { tipo: 'hr' };

function ehSeparadorTabela(linha: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(linha.trim()) && linha.includes('-');
}

function celulasTabela(linha: string): string[] {
  return linha
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

// Faz o parsing do texto em blocos de markdown
function parseBlocos(texto: string): Bloco[] {
  const linhas = texto.split('\n');
  const blocos: Bloco[] = [];
  let i = 0;

  while (i < linhas.length) {
    const l = linhas[i] ?? '';
    const trim = l.trim();

    // bloco de codigo com fence ```
    if (trim.startsWith('```')) {
      const linguagem = trim.slice(3).trim();
      const conteudo: string[] = [];
      i++;
      while (i < linhas.length && !(linhas[i] ?? '').trim().startsWith('```')) {
        conteudo.push(linhas[i] ?? '');
        i++;
      }
      i++; // pula o fence de fechamento
      blocos.push({ tipo: 'codigo', linguagem, linhas: conteudo });
      continue;
    }

    // titulo
    const h = trim.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      blocos.push({ tipo: 'titulo', nivel: h[1]!.length, texto: h[2]!.trim() });
      i++;
      continue;
    }

    // linha horizontal
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trim)) {
      blocos.push({ tipo: 'hr' });
      i++;
      continue;
    }

    // citacao
    if (trim.startsWith('>')) {
      const cit: string[] = [];
      while (i < linhas.length && (linhas[i] ?? '').trim().startsWith('>')) {
        cit.push((linhas[i] ?? '').trim().replace(/^>\s?/, ''));
        i++;
      }
      blocos.push({ tipo: 'citacao', linhas: cit });
      continue;
    }

    // tabela: linha com | seguida de separador
    if (trim.includes('|') && i + 1 < linhas.length && ehSeparadorTabela(linhas[i + 1] ?? '')) {
      const cabecalho = celulasTabela(l);
      i += 2; // pula cabecalho e separador
      const linhasTabela: string[][] = [];
      while (i < linhas.length && (linhas[i] ?? '').trim().includes('|')) {
        linhasTabela.push(celulasTabela(linhas[i] ?? ''));
        i++;
      }
      blocos.push({ tipo: 'tabela', cabecalho, linhas: linhasTabela });
      continue;
    }

    // lista / checklist: agrupa linhas consecutivas do mesmo estilo
    const ehItemLista = /^[-*]\s+/.test(trim) || /^\d+[.)]\s+/.test(trim);
    const ehCheck = /^-\s*\[[ xX]\]\s+/.test(trim);
    if (ehItemLista || ehCheck) {
      const itens: Array<{ texto: string; ordenado: boolean; check?: boolean; marcado?: boolean }> = [];
      while (i < linhas.length) {
        const t = (linhas[i] ?? '').trim();
        const check = t.match(/^-\s*\[([ xX])\]\s*(.+)$/);
        if (check) {
          itens.push({ texto: check[2] ?? '', ordenado: false, check: true, marcado: check[1]!.toLowerCase() === 'x' });
        } else {
          const ul = t.match(/^[-*]\s+(.+)$/);
          const ol = t.match(/^\d+[.)]\s+(.+)$/);
          if (ul) itens.push({ texto: ul[1] ?? '', ordenado: false });
          else if (ol) itens.push({ texto: ol[1] ?? '', ordenado: true });
          else break;
        }
        i++;
      }
      blocos.push({ tipo: 'lista', itens });
      continue;
    }

    // paragrafo: junta linhas ate encontrar inicio de outro bloco
    const par: string[] = [];
    while (i < linhas.length) {
      const t = (linhas[i] ?? '').trim();
      const proximoBloco =
        t === '' ||
        t.startsWith('```') ||
        /^#{1,3}\s/.test(t) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(t) ||
        t.startsWith('>') ||
        /^[-*]\s/.test(t) ||
        /^\d+[.)]\s/.test(t) ||
        (t.includes('|') && i + 1 < linhas.length && ehSeparadorTabela(linhas[i + 1] ?? ''));
      if (proximoBloco && par.length > 0) break;
      if (proximoBloco && par.length === 0) break;
      par.push(linhas[i] ?? '');
      i++;
      if (t === '') break;
    }
    // remove linhas vazias das pontas do paragrafo
    while (par.length && par[0]!.trim() === '') par.shift();
    while (par.length && par[par.length - 1]!.trim() === '') par.pop();
    if (par.length === 0) {
      i++;
      continue;
    }
    blocos.push({ tipo: 'p', linhas: par });
  }

  return blocos;
}

// Renderiza um bloco de markdown
function renderBloco(bloco: Bloco, idx: number): ReactNode {
  switch (bloco.tipo) {
    case 'codigo':
      return (
        <pre key={idx} className="md-pre">
          <code>{bloco.linhas.join('\n')}</code>
        </pre>
      );
    case 'titulo': {
      const Tag = (`h${Math.min(bloco.nivel + 2, 4)}`) as 'h3' | 'h4' | 'h5';
      return (
        <Tag key={idx} className="md-titulo">
          {inline(bloco.texto, `t${idx}`)}
        </Tag>
      );
    }
    case 'hr':
      return <hr key={idx} className="md-hr" />;
    case 'citacao':
      return (
        <blockquote key={idx} className="md-citacao">
          {bloco.linhas.map((c, j) => (
            <p key={j}>{inline(c, `q${idx}-${j}`)}</p>
          ))}
        </blockquote>
      );
    case 'tabela':
      return (
        <div key={idx} className="md-tabela-wrap">
          <table className="md-tabela">
            <thead>
              <tr>
                {bloco.cabecalho.map((c, j) => (
                  <th key={j}>{inline(c, `th${idx}-${j}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((linha, j) => (
                <tr key={j}>
                  {linha.map((c, k) => (
                    <td key={k}>{inline(c, `td${idx}-${j}-${k}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'lista': {
      const temCheck = bloco.itens.some((it) => it.check);
      const temOrdenado = bloco.itens.some((it) => it.ordenado);
      if (temCheck) {
        return (
          <ul key={idx} className="md-check">
            {bloco.itens.map((it, j) => (
              <CheckItem key={j} texto={it.texto} marcadoInicial={it.marcado ?? false} chave={`c${idx}-${j}`} />
            ))}
          </ul>
        );
      }
      const Lista = temOrdenado ? 'ol' : 'ul';
      return (
        <Lista key={idx} className="md-lista">
          {bloco.itens.map((it, j) => (
            <li key={j}>{inline(it.texto, `l${idx}-${j}`)}</li>
          ))}
        </Lista>
      );
    }
    case 'p':
      return (
        <p key={idx} className="md-p">
          {bloco.linhas.map((linha, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {inline(linha, `p${idx}-${j}`)}
            </span>
          ))}
        </p>
      );
  }
}

// Componente principal de renderizacao de markdown
export function Markdown({ texto }: { texto: string }) {
  const blocos = parseBlocos(texto);
  return <div className="md">{blocos.map((b, i) => renderBloco(b, i))}</div>;
}
