import type { PDFPageProxy, OPS, Util } from "pdfjs-dist";
type PDFOperatorList = Awaited<ReturnType<PDFPageProxy["getOperatorList"]>>;
import type { PdfEdge } from "./types";

export function pageEdges(ops: PDFOperatorList, viewport: number[], pdf: { OPS: typeof OPS; Util: typeof Util }) {
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const horizontal: PdfEdge[] = [],
    vertical: PdfEdge[] = [];
  function edge(a: number[], b: number[]) {
    const transform = pdf.Util.transform(viewport, matrix);
    pdf.Util.applyTransform(a, transform);
    pdf.Util.applyTransform(b, transform);
    if (Math.abs(a[1] - b[1]) < 1 && Math.abs(a[0] - b[0]) > 8) {
      horizontal.push({ position: (a[1] + b[1]) / 2, start: Math.min(a[0], b[0]), end: Math.max(a[0], b[0]) });
    } else if (Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) > 8) {
      vertical.push({ position: (a[0] + b[0]) / 2, start: Math.min(a[1], b[1]), end: Math.max(a[1], b[1]) });
    }
  }
  for (let i = 0; i < ops.fnArray.length; i++) {
    const op = ops.fnArray[i],
      args = ops.argsArray[i];
    if (op === pdf.OPS.save) {
      stack.push([...matrix]);
    } else if (op === pdf.OPS.restore) {
      matrix = stack.pop()!;
    } else if (op === pdf.OPS.transform) {
      matrix = pdf.Util.transform(matrix, args);
    } else if (op === pdf.OPS.constructPath && args[2]) {
      // shortcut: 使用锁定的 PDF.js 6 路径编码，升级依赖时复查绘图指令格式。
      const data: Float32Array = args[1][0];
      const points: number[][] = [];
      let first = [0, 0],
        previous = first;
      let curved = false;
      for (let j = 0; j < data.length;) {
        const draw = data[j++];
        if (draw === 0) {
          first = previous = [data[j++], data[j++]];
        } else if (draw === 1) {
          const next = [data[j++], data[j++]];
          points.push(previous, next);
          previous = next;
        } else if (draw === 4) {
          points.push(previous, first);
          previous = first;
        } else {
          j += draw === 2 ? 6 : 4;
          curved = true;
        }
      }
      const stroked = [
        pdf.OPS.stroke,
        pdf.OPS.closeStroke,
        pdf.OPS.fillStroke,
        pdf.OPS.eoFillStroke,
        pdf.OPS.closeFillStroke,
        pdf.OPS.closeEOFillStroke,
      ].includes(args[0]);
      const bbox: number[] = args[2];
      // Filled thin rectangles are also commonly used for table borders.
      if (!curved && (stroked || Math.min(bbox[2] - bbox[0], bbox[3] - bbox[1]) <= 2)) {
        for (let j = 0; j < points.length; j += 2) {
          edge([...points[j]], [...points[j + 1]]);
        }
      }
    }
  }
  return { horizontal: mergeEdges(horizontal), vertical: mergeEdges(vertical) };
}

function mergeEdges(edges: PdfEdge[]): PdfEdge[] {
  const merged: PdfEdge[] = [];
  for (const edge of edges.sort((a, b) => a.position - b.position || a.start - b.start)) {
    const previous = merged.findLast(
      (e) => Math.abs(e.position - edge.position) <= 2 && e.end >= edge.start - 3 && e.start <= edge.end + 3,
    );
    if (previous) {
      previous.start = Math.min(previous.start, edge.start);
      previous.end = Math.max(previous.end, edge.end);
    } else {
      merged.push({ ...edge });
    }
  }
  return merged;
}
