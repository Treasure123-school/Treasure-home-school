// jsPDF stub - PDF export disabled in this environment
class jsPDF {
  constructor() { this._pages = []; }
  text() { return this; }
  addImage() { return this; }
  setFontSize() { return this; }
  setFont() { return this; }
  setTextColor() { return this; }
  setFillColor() { return this; }
  rect() { return this; }
  line() { return this; }
  addPage() { return this; }
  save(filename) { console.warn('[jsPDF stub] PDF export is not available in this environment:', filename); }
  output() { return ''; }
  html() { return Promise.resolve(this); }
  get internal() { return { pageSize: { getWidth: () => 210, getHeight: () => 297 } }; }
}
export default jsPDF;
