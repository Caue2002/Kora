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
