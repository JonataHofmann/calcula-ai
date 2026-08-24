/**
 * Password-aware PDF text extraction backed by pdfjs-dist (legacy Node build).
 * Never logs the password or the extracted content. Errors are typed so callers
 * can map them to 400s without leaking why beyond the coarse reason.
 */
import { loadPdfjs } from './pdfjs-loader';

/** Wrong or missing password for an encrypted PDF. */
export class InvalidPdfPasswordError extends Error {
  constructor(message = 'Senha do PDF inválida') {
    super(message);
    this.name = 'InvalidPdfPasswordError';
  }
}

/** PDF could not be parsed or yielded no extractable text. */
export class UnreadablePdfError extends Error {
  constructor(message = 'PDF ilegível ou sem texto') {
    super(message);
    this.name = 'UnreadablePdfError';
  }
}

// pdfjs PasswordException codes.
const PASSWORD_EXCEPTION_CODES = new Set([1, 2]);

/**
 * Drops stray bytes preceding the `%PDF-` header. Some sources ship the
 * document padded with leading NUL bytes (observed on Banco Inter invoices,
 * ~500 KB of zeros before the header); pdfjs only scans the first ~1 KB for the
 * header and rejects such files as unreadable. The bytes before the header are
 * not part of the PDF per spec, so slicing them off is lossless. Returns the
 * buffer unchanged when the header is already at offset 0 or absent.
 */
function normalizePdfBuffer(buffer: Buffer): Buffer {
  const headerIndex = buffer.indexOf('%PDF-', 0, 'latin1');
  return headerIndex > 0 ? buffer.subarray(headerIndex) : buffer;
}

function isPasswordException(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: unknown }).name;
  const code = (error as { code?: unknown }).code;
  return (
    name === 'PasswordException' ||
    (typeof code === 'number' && PASSWORD_EXCEPTION_CODES.has(code))
  );
}

/**
 * Extracts the full text of `buffer`, decrypting with `password` when provided.
 * @throws InvalidPdfPasswordError on wrong/missing password
 * @throws UnreadablePdfError when the document cannot be parsed or has no text
 */
export async function readPdfText(
  buffer: Buffer,
  password?: string,
): Promise<string> {
  const pdfjs = await loadPdfjs();

  const normalized = normalizePdfBuffer(buffer);
  const data = new Uint8Array(
    normalized.buffer,
    normalized.byteOffset,
    normalized.byteLength,
  );

  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    doc = await pdfjs.getDocument({
      data,
      password,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
  } catch (error) {
    if (isPasswordException(error)) {
      throw new InvalidPdfPasswordError();
    }
    throw new UnreadablePdfError();
  }

  try {
    const parts: string[] = [];
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      parts.push(pageText);
    }
    const text = parts.join('\n').trim();
    if (!text) {
      throw new UnreadablePdfError();
    }
    return text;
  } catch (error) {
    if (error instanceof UnreadablePdfError) throw error;
    throw new UnreadablePdfError();
  } finally {
    await doc.destroy();
  }
}
