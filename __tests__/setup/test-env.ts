Object.assign(process.env, {
  NODE_ENV: 'test',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'test-secret-key-for-testing-32-chars-min',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  TEST_DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:password@localhost:5432/gridcore_test',
})

jest.setTimeout(30000)

export {}