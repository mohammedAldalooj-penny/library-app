import { normalizeGooglePrivateKey } from './gemini.service';

describe('normalizeGooglePrivateKey', () => {
  it('restores escaped newlines from an environment variable', () => {
    expect(normalizeGooglePrivateKey('first\\nsecond\\n')).toBe(
      'first\nsecond\n',
    );
  });

  it('keeps multiline private keys unchanged', () => {
    expect(normalizeGooglePrivateKey('first\nsecond\n')).toBe(
      'first\nsecond\n',
    );
  });
});
