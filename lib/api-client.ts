// cliente de api centralizado pra nao ficar repetindo fetch em todo lugar
// trata erro de rede e padroniza as respostas

export class ApiError extends Error {
  public status: number;
  public details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface FetchOptions extends RequestInit {
  // TODO: implementar retry futuramente
  retries?: number;
}

export const apiClient = {
  async fetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { headers, ...customOptions } = options;
    
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        ...customOptions,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || 'Ocorreu um erro na requisição.';
        throw new ApiError(errorMessage, response.status, data?.details);
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error; // já é ApiError, joga de volta
      }
      // erro de rede mesmo, servidor caiu ou sem internet
      throw new ApiError('Erro de conexão com o servidor.', 503);
    }
  },

  async get<T = any>(endpoint: string, options?: FetchOptions) {
    return this.fetch<T>(endpoint, { ...options, method: 'GET' });
  },

  async post<T = any>(endpoint: string, body: any, options?: FetchOptions) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async put<T = any>(endpoint: string, body: any, options?: FetchOptions) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async delete<T = any>(endpoint: string, options?: FetchOptions) {
    return this.fetch<T>(endpoint, { ...options, method: 'DELETE' });
  },
};
