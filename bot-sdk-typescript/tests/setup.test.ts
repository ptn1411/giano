/**
 * Basic setup test to verify Jest and TypeScript configuration
 */

describe('Bot SDK Setup', () => {
  test('Jest is configured correctly', () => {
    expect(true).toBe(true);
  });

  test('TypeScript types work correctly', () => {
    const message: string = 'Hello, Bot SDK!';
    expect(message).toBe('Hello, Bot SDK!');
  });

  test('fast-check is available', async () => {
    const fc = await import('fast-check');
    expect(fc).toBeDefined();
    expect(fc.assert).toBeDefined();
  });
});
