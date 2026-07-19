import React from 'react';

interface ReportHeaderProps {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  termName: string;
  logoSrc: string;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({
  schoolName, schoolAddress, schoolPhone, schoolEmail, termName, logoSrc,
}) => (
  <>
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
      <tbody><tr>
        <td style={{ verticalAlign: 'middle', paddingRight: 10 }}>
          <div style={{
            fontFamily: '"Times New Roman", Georgia, serif',
            fontSize: 24, fontWeight: 900, letterSpacing: 2,
            textTransform: 'uppercase', lineHeight: 1.15, marginBottom: 4,
          }}>
            {schoolName}
          </div>
          <div style={{ fontSize: 10, marginBottom: 3, fontStyle: 'italic', color: '#222' }}>
            {schoolAddress}
          </div>
          <div style={{ fontSize: 9, color: '#333' }}>
            TEL: {schoolPhone}{schoolEmail ? `  |  Email: ${schoolEmail}` : ''}
          </div>
        </td>
        <td style={{ width: 70, verticalAlign: 'middle', textAlign: 'right' }}>
          {logoSrc && (
            <img src={logoSrc} alt="Logo" style={{ height: 65, width: 65, objectFit: 'contain' }} />
          )}
        </td>
      </tr></tbody>
    </table>

    <div style={{ borderBottom: '2.5px solid #000', marginBottom: 6 }} />

    <div style={{
      textAlign: 'center', fontWeight: 'bold', fontSize: 12,
      letterSpacing: 0.5, marginBottom: 8,
    }}>
      {(termName || 'FIRST TERM').toUpperCase()} STUDENT'S PERFORMANCE REPORT
    </div>
  </>
);

export default ReportHeader;
