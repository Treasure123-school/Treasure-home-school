/**
 * jsPDF stub — replaces the real jspdf bundle via Vite alias.
 *
 * jspdf v3 has undeclared deps (fast-png, fflate, @babel/runtime) that
 * cause Rollup to fail at build time. This stub satisfies the import
 * contract used by report-export-utils.ts / baileys-report-template.tsx
 * while degrading gracefully (PDF downloads are not available in the
 * deployed SPA — the Express backend handles server-side PDF generation).
 */
class jsPDF {
  constructor(options) {
    this._options = options || {};
    this._pages = [1];
  }
  // --- text / layout ---
  text() { return this; }
  setFontSize() { return this; }
  setFont() { return this; }
  setTextColor() { return this; }
  setFillColor() { return this; }
  setDrawColor() { return this; }
  setLineWidth() { return this; }
  setProperties() { return this; }
  // --- shapes ---
  rect() { return this; }
  roundedRect() { return this; }
  line() { return this; }
  circle() { return this; }
  ellipse() { return this; }
  // --- images ---
  addImage() { return this; }
  // --- pages ---
  addPage() { this._pages.push(this._pages.length + 1); return this; }
  deletePage() { return this; }
  setPage() { return this; }
  getNumberOfPages() { return this._pages.length; }
  // --- utilities ---
  splitTextToSize(text) { return Array.isArray(text) ? text : [String(text)]; }
  getTextWidth() { return 0; }
  getStringUnitWidth() { return 0; }
  // --- output ---
  save(filename) {
    console.warn('[jsPDF stub] PDF export is not available:', filename);
  }
  output(type) {
    if (type === 'arraybuffer') return new ArrayBuffer(0);
    if (type === 'blob') return new Blob([], { type: 'application/pdf' });
    return '';
  }
  html() { return Promise.resolve(this); }
  // --- internal (accessed by some helpers) ---
  get internal() {
    return {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
        width: 210,
        height: 297,
      },
      pages: this._pages,
      scaleFactor: 1,
    };
  }
}

export default jsPDF;
export { jsPDF };
