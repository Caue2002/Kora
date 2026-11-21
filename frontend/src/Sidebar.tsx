// Barra lateral de historico de chats, no estilo do Gemini
// Lista os chats salvos e permite abrir, renomear, excluir e criar novo

import type { Conversa } from './api';
import { formatarDataCurta } from './utils';

interface Props {
  conversas: Conversa[];
  atualId: string | null;
  aberta: boolean;
  onSelecionar: (c: Conversa) => void;
  onExcluir: (id: string) => void;
  onRenomear: (id: string, titulo: string) => void;
  onFechar: () => void;
}

export default function Sidebar({ conversas, atualId, aberta, onSelecionar, onExcluir, onRenomear, onFechar }: Props) {
  return (
    <>
      {aberta && <div className="sidebar-backdrop" onClick={onFechar} />}
      <aside className={`sidebar ${aberta ? 'aberta' : ''}`}>
        <div className="sidebar-topo">
          <img src="/logo.svg" alt="Nori" className="sidebar-logo" />
          <span className="sidebar-nome">Nori</span>
        </div>

        <div className="sidebar-lista">
          {conversas.length === 0 && <p className="sidebar-vazio">Nenhum chat ainda.</p>}
          {[...conversas]
            .sort((a, b) => b.atualizadoEm - a.atualizadoEm)
            .map((c) => (
              <div
                key={c.id}
                className={`sidebar-item ${c.id === atualId ? 'ativa' : ''}`}
                onClick={() => onSelecionar(c)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelecionar(c)}
              >
                <span className="sidebar-item-titulo">{c.titulo}</span>
                <span className="sidebar-item-data">{formatarDataCurta(c.atualizadoEm)}</span>
                <button
                  className="sidebar-item-renomear"
                  title="Renomear chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    const novo = window.prompt('Novo nome do chat:', c.titulo);
                    if (novo && novo.trim() && novo.trim() !== c.titulo) onRenomear(c.id, novo.trim());
                  }}
                >
                  ✎
                </button>
                <button
                  className="sidebar-item-excluir"
                  title="Excluir chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExcluir(c.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
        </div>
      </aside>
    </>
  );
}
