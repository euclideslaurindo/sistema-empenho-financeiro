// Fallback de tipagem para o Language Server do IDE enquanto os pacotes não são baixados para node_modules
declare module 'vitest/config' {
  export interface UserConfig {
    test?: {
      environment?: string;
      globals?: boolean;
      setupFiles?: string[];
      alias?: Record<string, string>;
      [key: string]: any;
    };
    [key: string]: any;
  }
  export function defineConfig(config: UserConfig): UserConfig;
}

declare module 'vitest' {
  export const describe: any;
  export const test: any;
  export const it: any;
  export const expect: any;
  export const vi: any;
  export const beforeAll: any;
  export const beforeEach: any;
  export const afterAll: any;
  export const afterEach: any;
}

declare module '@testing-library/jest-dom';
declare module '@testing-library/react';
