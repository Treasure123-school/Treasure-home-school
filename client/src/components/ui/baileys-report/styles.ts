// ─── Layout constants ───
export const B = '1px solid #000';
export const BL = '1px solid #555';
export const FONT = '"Arial Narrow", Arial, Helvetica, sans-serif';
export const MIN_ROWS = 20;
export const GAP = 5;

// ─── Signature size — increase this value to make signatures bigger ───
export const SIG_HEIGHT = 80;

// ─── Shared inline styles (no flexbox — html2canvas compatible) ───
export const sectionHeader: React.CSSProperties = {
  backgroundColor: '#ddd', textAlign: 'center', padding: '4px 0',
  fontWeight: 'bold', fontSize: 9, borderBottom: '1px solid #000', letterSpacing: 1,
};

/** Label cell: grey background, bordered */
export const labelCell: React.CSSProperties = {
  padding: '3px 6px', fontSize: 9, fontWeight: 700,
  verticalAlign: 'middle', whiteSpace: 'nowrap',
  backgroundColor: '#f0f0f0', border: '1px solid #555',
};

/** Value cell: white background, bordered */
export const valueCell: React.CSSProperties = {
  padding: '3px 6px', fontSize: 9, fontWeight: 500,
  verticalAlign: 'middle', border: '1px solid #555',
};
