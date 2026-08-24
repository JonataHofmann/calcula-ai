import {
  InvalidPdfPasswordError,
  readPdfText,
  UnreadablePdfError,
} from './pdf-reader';

// jest's VM cannot evaluate pdfjs' real ESM without --experimental-vm-modules,
// so we mock the loader and drive getDocument to exercise the error mapping.
const getDocument = jest.fn();
jest.mock('./pdfjs-loader', () => ({
  loadPdfjs: () => Promise.resolve({ getDocument }),
}));

class PasswordException extends Error {
  constructor(public code: number) {
    super('password');
    this.name = 'PasswordException';
  }
}

/** Builds a fake pdfjs doc whose pages yield the given per-page text items. */
function fakeDoc(pages: string[][]) {
  return {
    numPages: pages.length,
    getPage: (n: number) =>
      Promise.resolve({
        getTextContent: () =>
          Promise.resolve({
            items: pages[n - 1].map((str) => ({ str })),
          }),
      }),
    destroy: () => Promise.resolve(),
  };
}

const BUFFER = Buffer.from('%PDF-1.4 fake');

beforeEach(() => getDocument.mockReset());

describe('readPdfText', () => {
  it('returns joined text on correct password', async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve(fakeDoc([['Mercado', '123.45'], ['Loja']])),
    });

    const text = await readPdfText(BUFFER, 'correct');

    expect(text).toBe('Mercado 123.45\nLoja');
    expect(getDocument).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'correct' }),
    );
  });

  it('throws InvalidPdfPasswordError on incorrect password (code 2)', async () => {
    getDocument.mockReturnValue({
      promise: Promise.reject(new PasswordException(2)),
    });

    await expect(readPdfText(BUFFER, 'wrong')).rejects.toBeInstanceOf(
      InvalidPdfPasswordError,
    );
  });

  it('throws InvalidPdfPasswordError when password is required but missing (code 1)', async () => {
    getDocument.mockReturnValue({
      promise: Promise.reject(new PasswordException(1)),
    });

    await expect(readPdfText(BUFFER)).rejects.toBeInstanceOf(
      InvalidPdfPasswordError,
    );
  });

  it('throws UnreadablePdfError when the document has no text', async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve(fakeDoc([[''], ['']])),
    });

    await expect(readPdfText(BUFFER, 'correct')).rejects.toBeInstanceOf(
      UnreadablePdfError,
    );
  });

  it('throws UnreadablePdfError when parsing fails for a non-password reason', async () => {
    getDocument.mockReturnValue({
      promise: Promise.reject(new Error('corrupt xref')),
    });

    await expect(readPdfText(BUFFER)).rejects.toBeInstanceOf(
      UnreadablePdfError,
    );
  });

  it('strips stray leading bytes before the %PDF header', async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve(fakeDoc([['Mercado']])),
    });
    const padded = Buffer.concat([Buffer.alloc(2048), BUFFER]);

    await readPdfText(padded);

    const passed = getDocument.mock.calls[0][0].data as Uint8Array;
    expect(Buffer.from(passed).toString('latin1')).toBe(BUFFER.toString('latin1'));
  });
});
