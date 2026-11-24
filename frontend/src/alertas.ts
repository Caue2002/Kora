// Mapeia erros da API para alertas curtos exibidos na tela (banner amarelo).
// Cada codigo tem sua propria mensagem: informal, direta e sem jargao,
// dizendo a causa real do erro. O numero exibido e o status HTTP
// (0 = falha de rede, sem resposta do servidor).

export interface AlertaErro {
  codigo: number;
  texto: string;
}

// Alerta de saturacao: a API respondeu 200 com o fallback porque TODOS os
// modelos de IA falharam — equivale a um 503 (servico indisponivel)
export const ALERTA_SATURACAO: AlertaErro = {
  codigo: 503,
  texto: 'a IA tá lotada — todos os modelos falharam agora. Tenta de novo daqui a pouco.',
};

// Converte o status HTTP (e a mensagem do servidor quando ajuda a
// distinguir a causa) no alerta correspondente
export function mapearErroApi(status: number, msgServidor?: string): AlertaErro {
  switch (status) {
    case 0:
      return {
        codigo: 0,
        texto: 'sem conexão com o servidor — confere sua internet e tenta de novo.',
      };
    case 400:
      return {
        codigo: 400,
        texto: 'sua mensagem veio vazia ou grande demais. Escreve de novo e tenta outra vez.',
      };
    case 405:
      return {
        codigo: 405,
        texto: 'essa ação não é permitida aqui.',
      };
    case 429:
      // Dois 429 diferentes: cotas dos modelos esgotadas (saturacao) x
      // rate limit de requisicoes do proprio usuario
      if (msgServidor?.toLowerCase().includes('cotas')) {
        return {
          codigo: 429,
          texto: 'a IA tá lotada — as cotas gratuitas dos modelos acabaram. Tenta de novo daqui a pouco.',
        };
      }
      return {
        codigo: 429,
        texto: 'você mandou mensagem rápido demais. Espera uns segundos e tenta de novo.',
      };
    case 500:
      return {
        codigo: 500,
        texto: 'o servidor quebrou do lado de lá. Tenta de novo em instantes.',
      };
    case 502:
      return {
        codigo: 502,
        texto: 'o servidor deu pau na hora de responder. Tenta de novo.',
      };
    case 503:
      return {
        codigo: 503,
        texto: 'o serviço tá fora do ar agora. Tenta daqui a pouco.',
      };
    case 504:
      return {
        codigo: 504,
        texto: 'demorou demais e o servidor desistiu. Tenta de novo.',
      };
    default:
      return {
        codigo: status,
        texto: 'algo deu errado no servidor. Tenta de novo.',
      };
  }
}
