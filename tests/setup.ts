import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Variáveis de ambiente padrão para testes
process.env.JWT_SECRET = 'chave-de-teste-unitario-123';
process.env.APP_URL = 'http://localhost:3000';

// Mock do next/server para não falhar testes de rota
vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: (body: any, init?: any) => {
        return {
          status: init?.status || 200,
          json: async () => body,
        };
      },
      redirect: (url: string) => {
        return { status: 302, url };
      },
    },
    NextRequest: class MockNextRequest {
      url: string;
      method: string;
      headers: Map<string, string>;
      bodyObj: any;
      
      constructor(url: string, options: any = {}) {
        this.url = url;
        this.method = options.method || 'GET';
        this.headers = new Map(Object.entries(options.headers || {}));
        this.bodyObj = options.body ? JSON.parse(options.body) : {};
      }
      
      async json() {
        return this.bodyObj;
      }
      
      get nextUrl() {
        return new URL(this.url);
      }
    }
  };
});
