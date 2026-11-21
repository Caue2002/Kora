// Barra lateral de historico de conversas, no estilo do Gemini
// Lista as conversas salvas, permite abrir, excluir e iniciar uma nova

import type { Conversa } from './api';
import { formatarDataCurta } from './utils';

interface Props {
  conversas: Conversa[];
  atualId: string | null;
  aberta: boolean;
  onSelecionar: (c: Conversa) => void;
  onNova: () => void;
  onExcluir: (id: string) => void;
  onFechar: () => void;
}

export default function Sidebar({ conversas, atualId, aberta, onSelecionar, onNova, onExcluir, onFechar }: Props) {
  return (
    <>
      {aberta && <div className="sidebar-backdrop" onClick={onFechar} />}
      <aside className={`sidebar ${aberta ? 'aberta' : ''}`}>
        <div className="sidebar-topo">
          <img src="/logo.svg" alt="Nori" className="sidebar-logo" />
          <span className="sidebar-nome">Nori</span>
        </div>

        <button className="sidebar-novo" onClick={onNova}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova conversa
        </button>

        <div className="sidebar-lista">
          {conversas.length === 0 && <p className="sidebar-vazio">Nenhuma conversa ainda.</p>}
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
                  className="sidebar-item-excluir"
                  title="Excluir conversa"
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
