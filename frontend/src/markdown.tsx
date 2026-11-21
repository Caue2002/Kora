// Renderizador leve de markdown para as respostas do Nori
// Suporta negrito, italico, listas, checklist e paragrafos
// Gera elementos React (sem dangerouslySetInnerHTML, sem risco de injecao)

import type { ReactNode } from 'react';

// Converte texto inline com **negrito**, *italico* e citacoes [n] em nos React
function inline(texto: string, chaveBase: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[\d+\])/g);
  return partes.map((p, i) => {
    const chave = `${chaveBase}-${i}`;
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={chave}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      return <em key={chave}>{p.slice(1, -1)}</em>;
    }
    if (/^\[\d+\]$/.test(p)) {
      return <sup key={chave} className="cite">{p}</sup>;
    }
    return <span key={chave}>{p}</span>;
  });
}

interface LinhaRenderizada {
  tipo: 'check' | 'ul' | 'ol' | 'p';
  texto: string;
  marcado?: boolean;
}

// Classifica cada linha do texto em checklist, item de lista ou paragrafo
function classificar(texto: string): LinhaRenderizada[] {
  return texto.split('\n').map((linha) => {
    const l = linha.trim();
    const check = l.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    if (check) return { tipo: 'check', texto: check[2] ?? '', marcado: check[1]!.toLowerCase() === 'x' };
    if (/^[-*]\s+/.test(l)) return { tipo: 'ul', texto: l.replace(/^[-*]\s+/, '') };
    const ol = l.match(/^\d+[.)]\s+(.+)$/);
    if (ol) return { tipo: 'ol', texto: ol[1] ?? '' };
    return { tipo: 'p', texto: l };
  });
}

// Renderiza o markdown agrupando linhas consecutivas do mesmo tipo de lista
export function renderMarkdown(texto: string): ReactNode {
  const linhas = classificar(texto);
  const blocos: ReactNode[] = [];
  let i = 0;

  while (i < linhas.length) {
    const atual = linhas[i]!;
    if (atual.tipo === 'ul' || atual.tipo === 'ol' || atual.tipo === 'check') {
      // agrupa linhas consecutivas de lista/checklist
      const itens: LinhaRenderizada[] = [];
      while (i < linhas.length && (linhas[i]!.tipo === 'ul' || linhas[i]!.tipo === 'ol' || linhas[i]!.tipo === 'check')) {
        itens.push(linhas[i]!);
        i++;
      }
      const ehCheck = itens.every((it) => it.tipo === 'check');
      blocos.push(
        ehCheck ? (
          <ul key={`b${blocos.length}`} className="md-check">
            {itens.map((it, j) => (
              <li key={j} className={it.marcado ? 'check-feito' : ''}>
                <span className="check-box">{it.marcado ? '☑' : '☐'}</span> {inline(it.texto, `c${blocos.length}-${j}`)}
              </li>
            ))}
          </ul>
        ) : (
          <ul key={`b${blocos.length}`} className="md-lista">
            {itens.map((it, j) => (
              <li key={j}>{inline(it.texto, `l${blocos.length}-${j}`)}</li>
            ))}
          </ul>
        ),
      );
      continue;
    }
    // paragrafo: junta linhas vazias como quebra simples
    if (atual.tipo === 'p' && atual.texto === '') {
      blocos.push(<div key={`b${blocos.length}`} className="md-espaco" />);
      i++;
      continue;
    }
    blocos.push(<p key={`b${blocos.length}`}>{inline(atual.texto, `p${blocos.length}`)}</p>);
    i++;
  }

  return <div className="md">{blocos}</div>;
}
