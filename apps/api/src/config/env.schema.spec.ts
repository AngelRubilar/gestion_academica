import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  const baseEnv = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'a-secret-with-at-least-32-characters-long-x',
  };

  it('parsea valores válidos y aplica defaults', () => {
    const result = validateEnv(baseEnv);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3001);
    expect(result.CORS_ORIGINS).toEqual(['http://localhost:3000']);
    expect(result.LOG_LEVEL).toBe('info');
    expect(result.SWAGGER_ENABLED).toBe(true);
  });

  it('coerce PORT a number', () => {
    const result = validateEnv({ ...baseEnv, PORT: '4000' });
    expect(result.PORT).toBe(4000);
    expect(typeof result.PORT).toBe('number');
  });

  it('parsea CORS_ORIGINS como array separado por coma', () => {
    const result = validateEnv({
      ...baseEnv,
      CORS_ORIGINS: 'http://localhost:3000, http://localhost:8081',
    });
    expect(result.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:8081',
    ]);
  });

  it('falla si DATABASE_URL está ausente', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: baseEnv.JWT_SECRET } as unknown as Record<string, unknown>),
    ).toThrow(/DATABASE_URL/);
  });

  it('falla si JWT_SECRET es menor a 32 caracteres', () => {
    expect(() => validateEnv({ ...baseEnv, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('parsea SWAGGER_ENABLED="false" como false', () => {
    const result = validateEnv({ ...baseEnv, SWAGGER_ENABLED: 'false' });
    expect(result.SWAGGER_ENABLED).toBe(false);
  });

  it('falla con SWAGGER_ENABLED inválido', () => {
    expect(() =>
      validateEnv({ ...baseEnv, SWAGGER_ENABLED: 'maybe' }),
    ).toThrow(/SWAGGER_ENABLED/);
  });

  it('falla con NODE_ENV inválido', () => {
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
