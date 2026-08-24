export type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

// pdfjs ships only ESM (.mjs). This service compiles to CommonJS, where `tsc`
// would down-level a plain `import()` to `require()` and break on the ESM
// module. Wrapping the dynamic import in a Function keeps a real native
// `import()` at runtime. Isolated here so tests can mock the loader (jest's VM
// cannot evaluate real ESM without --experimental-vm-modules).
const nativeImport = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<PdfjsModule>;

let pdfjsPromise: Promise<PdfjsModule> | undefined;

export function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = nativeImport('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsPromise;
}
