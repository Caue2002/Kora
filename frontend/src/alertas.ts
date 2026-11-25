// Mapeia erros da API para alertas curtos exibidos na tela (barra inferior).
// Cada codigo tem sua propria mensagem: so o numero do erro e uma frase
// minima dizendo a causa. O numero exibido e o status HTTP
// (0 = falha de rede, sem resposta do servidor).

export interface AlertaErro {
  codigo: number;
  texto: string;
}

// Alerta de saturacao: a API respondeu 200 com o fallback porque TODOS os
// modelos de IA falharam — equivale a um 503 (servico indisponivel)
export const ALERTA_SATURACAO: AlertaErro = {
  codigo: 503,
  texto: 'Saturação do modelo.',
};

// Converte o status HTTP (e a mensagem do servidor quando ajuda a
// distinguir a causa) no alerta correspondente
export function mapearErroApi(status: number, msgServidor?: string): AlertaErro {
  switch (status) {
    case 0:
      return { codigo: 0, texto: 'Sem conexão.' };
    case 400:
      return { codigo: 400, texto: 'Mensagem inválida.' };
    case 401:
      return { codigo: 401, texto: 'Acesso negado.' };
    case 403:
      return { codigo: 403, texto: 'Acesso proibido.' };
    case 404:
      return { codigo: 404, texto: 'Recurso não encontrado.' };
    case 405:
      return { codigo: 405, texto: 'Método não permitido.' };
    case 413:
      return { codigo: 413, texto: 'Arquivo muito grande.' };
    case 429:
      // Dois 429 diferentes: cotas dos modelos esgotadas (saturacao) x
      // rate limit de requisicoes do proprio usuario
      if (msgServidor?.toLowerCase().includes('cotas')) {
        return { codigo: 429, texto: 'Cotas esgotadas.' };
      }
      return { codigo: 429, texto: 'Muitas requisições.' };
    case 500:
      return { codigo: 500, texto: 'Erro interno.' };
    case 502:
      return { codigo: 502, texto: 'Falha no servidor.' };
    case 503:
      return { codigo: 503, texto: 'Serviço indisponível.' };
    case 504:
      return { codigo: 504, texto: 'Tempo esgotado.' };
    default:
      return { codigo: status, texto: 'Falha no servidor.' };
  }
}
