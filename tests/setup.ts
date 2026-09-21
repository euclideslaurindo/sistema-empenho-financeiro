import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Variáveis de ambiente padrão para testes
process.env.JWT_SECRET = 'chave-de-teste-unitario-123';
process.env.APP_URL = 'http://localhost:3000';

// Mock do next/server para não falhar testes de rota
vi.mock('next/server', () => {
  class MockCookies {
    private cookies: Map<string, string> = new Map();

    get(name: string) {
      const value = this.cookies.get(name);
      return value ? { value } : undefined;
    }

    set(name: string, value: string, options?: Record<string, any>) {
      this.cookies.set(name, value);
    }

    delete(name: string) {
      this.cookies.delete(name);
    }
  }

  return {
    NextResponse: {
      json: (body: any, init?: any) => {
        const cookies = new MockCookies();
        const headers = new Map<string, string>();
        if (init?.headers) {
          Object.entries(init.headers).forEach(([k, v]) => headers.set(k, String(v)));
        }
        return {
          status: init?.status || 200,
          json: async () => body,
          headers: {
            get: (name: string): string | null => headers.get(name) || null,
          },
          cookies: {
            set: vi.fn((name: string, value: string, options?: any) => cookies.set(name, value, options)),
            delete: vi.fn((name: string) => cookies.delete(name)),
            get: vi.fn((name: string) => cookies.get(name)),
          },
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
      cookies: MockCookies;

      constructor(url: string, options: any = {}) {
        this.url = url;
        this.method = options.method || 'GET';
        this.headers = new Map(Object.entries(options.headers || {}));
        this.bodyObj = options.body ? JSON.parse(options.body) : {};

        this.cookies = new MockCookies();
        if (options.cookies) {
          Object.entries(options.cookies).forEach(([key, val]: [string, any]) => {
            this.cookies.set(key, val);
          });
        }
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
