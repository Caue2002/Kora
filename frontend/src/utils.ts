// Utilitarios de formatacao de data para a interface

// Formata timestamp como "21/11 14:32" para itens do historico
export function formatarDataCurta(ts: number): string {
  const d = new Date(ts);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes} ${hora}:${min}`;
}

// Formata timestamp de forma relativa para mensagens recentes
// "agora", "ha 5 min", "14:32" (hoje) ou "21/11 14:32" (dias anteriores)
export function formatarHoraRelativa(ts?: number): string {
  if (!ts) return '';
  const agora = Date.now();
  const diff = agora - ts;
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`;
  const d = new Date(ts);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  if (mesmoDia) return `${hora}:${min}`;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes} ${hora}:${min}`;
}

// Formata timestamp de mensagem como hora exata: "14:32" (hoje) ou "21/11 14:32"
export function formatarHoraMensagem(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === new Date().toDateString()) return `${hora}:${min}`;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes} ${hora}:${min}`;
}

// Converte markdown simples em HTML para o arquivo de parecer exportado
// Cobre: escape de HTML, titulos ##, negrito ** e quebras de linha
export function mdParaHtml(md: string): string {
  const escapado = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escapado
    .split('\n')
    .map((linha) => {
      let html = linha.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      if (html.startsWith('## ')) return `<h2>${html.slice(3)}</h2>`;
      if (html.startsWith('# ')) return `<h1>${html.slice(2)}</h1>`;
      return html || '<br>';
    })
    .join('\n');
}
