// Shared by the Vitest setup and global setup.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://gymos:gymos@localhost:5432/gymos_test";

export function assertTestDatabase(url: string) {
  const { pathname } = new URL(url);
  if (!/test/i.test(pathname)) {
    throw new Error(`Refusing to run tests against ${pathname}: the database name must contain "test".`);
  }
}
