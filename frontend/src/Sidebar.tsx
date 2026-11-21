// Barra lateral de historico de conversas, no estilo do Gemini
// Lista as conversas salvas com busca, permite abrir, renomear, excluir e criar nova

import { useState } from 'react';
import type { Conversa, Mensagem } from './api';
import { formatarDataCurta } from './utils';

interface Props {
  conversas: Conversa[];
  atualId: string | null;
  aberta: boolean;
  onSelecionar: (c: Conversa) => void;
  onNova: () => void;
  onExcluir: (id: string) => void;
  onRenomear: (id: string, titulo: string) => void;
  onFechar: () => void;
}

// Verifica se a conversa combina com o termo de busca (titulo ou conteudo)
function combinaBusca(c: Conversa, termo: string): boolean {
  const t = termo.toLowerCase();
  if (c.titulo.toLowerCase().includes(t)) return true;
  return c.mensagens.some((m: Mensagem) => m.content.toLowerCase().includes(t));
}

export default function Sidebar({ conversas, atualId, aberta, onSelecionar, onNova, onExcluir, onRenomear, onFechar }: Props) {
  const [busca, setBusca] = useState('');

  const filtradas = busca.trim()
    ? conversas.filter((c) => combinaBusca(c, busca.trim()))
    : conversas;

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

        <div className="sidebar-busca">
          <input
            className="sidebar-busca-input"
            placeholder="Buscar conversas..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="sidebar-lista">
          {filtradas.length === 0 && (
            <p className="sidebar-vazio">
              {conversas.length === 0 ? 'Nenhuma conversa ainda.' : 'Nenhuma conversa encontrada.'}
            </p>
          )}
          {[...filtradas]
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
                  title="Renomear conversa"
                  onClick={(e) => {
                    e.stopPropagation();
                    const novo = window.prompt('Novo nome da conversa:', c.titulo);
                    if (novo && novo.trim() && novo.trim() !== c.titulo) onRenomear(c.id, novo.trim());
                  }}
                >
                  ✎
                </button>
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
