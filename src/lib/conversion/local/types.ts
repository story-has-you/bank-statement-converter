export type PdfWord = { text: string; x0: number; x1: number; top: number; bottom: number; unresolved?: boolean; fontSize?: number };
export type PdfLine = { words: PdfWord[]; top: number };
export type PdfEdge = { position: number; start: number; end: number };
export type PdfPage = { words: PdfWord[]; horizontal: PdfEdge[]; vertical: PdfEdge[]; hasImages: boolean };
