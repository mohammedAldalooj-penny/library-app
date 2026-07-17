import { parseGoogleCredentials } from './gemini.service';

describe('parseGoogleCredentials', () => {
  it('decodes a service-account credential', () => {
    const encoded = Buffer.from(
      JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
        private_key: 'private-key',
        client_email: 'service@example.com',
      }),
    ).toString('base64');

    expect(parseGoogleCredentials(encoded)).toMatchObject({
      project_id: 'test-project',
      client_email: 'service@example.com',
    });
  });

  it('rejects incomplete credentials', () => {
    const encoded = Buffer.from(
      JSON.stringify({ type: 'service_account' }),
    ).toString('base64');

    expect(() => parseGoogleCredentials(encoded)).toThrow(
      'GOOGLE_CREDS_B64 is not a valid service-account credential',
    );
  });
});
