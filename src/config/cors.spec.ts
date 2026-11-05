import { DEFAULT_ALLOWED_ORIGINS, getAllowedOrigins } from './cors.js';

describe('getAllowedOrigins', () => {
  it('uses the local default when no origins are configured', () => {
    expect(getAllowedOrigins('')).toEqual(DEFAULT_ALLOWED_ORIGINS);
  });

  it('parses comma-separated origins and removes surrounding whitespace', () => {
    expect(
      getAllowedOrigins('https://app.example.com, http://localhost:5173'),
    ).toEqual(['https://app.example.com', 'http://localhost:5173']);
  });

  it('ignores empty entries', () => {
    expect(getAllowedOrigins('https://app.example.com, ,')).toEqual([
      'https://app.example.com',
    ]);
  });
});
