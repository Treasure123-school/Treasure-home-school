import React from 'react';
import type { ReportCardData } from '../types';
import { B, GAP, SIG_HEIGHT, labelCell, valueCell } from '../styles';
import { formatPosition } from '../utils';

interface BottomSectionProps {
  reportCard: ReportCardData;
  teacherSigSrc: string;
  principalSigSrc: string;
  schoolName: string;
  schoolAddress: string;
  schoolMotto: string;
}

const BottomSection: React.FC<BottomSectionProps> = ({
  reportCard, teacherSigSrc, principalSigSrc,
  schoolName, schoolAddress, schoolMotto,
}) => (
  <div style={{ marginTop: 6 }}>

    {/* Teacher's Remark */}
    <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginBottom: GAP, tableLayout: 'fixed' }}>
      <colgroup><col style={{ width: '18%' }} /><col /></colgroup>
      <tbody><tr>
        <td style={labelCell}>Teacher's Remark:</td>
        <td style={{ ...valueCell, fontStyle: 'italic', minHeight: 24, lineHeight: 1.5, wordBreak: 'break-word' as const }}>
          {reportCard.teacherRemarks || ''}
        </td>
      </tr></tbody>
    </table>

    {/* Teacher Name + Signature */}
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: GAP, tableLayout: 'fixed', border: B }}>
      <colgroup>
        <col style={{ width: '18%' }} />
        <col style={{ width: '47%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '27%' }} />
      </colgroup>
      <tbody><tr>
        <td style={labelCell}>Teacher's Name:</td>
        <td style={{ ...valueCell, textTransform: 'uppercase', fontWeight: 600 }}>
          {reportCard.teacherName || ''}
        </td>
        <td style={labelCell}>Sign:</td>
        <td style={{ ...valueCell, minHeight: SIG_HEIGHT, verticalAlign: 'middle' }}>
          {teacherSigSrc
            ? <img src={teacherSigSrc} alt="" style={{ height: SIG_HEIGHT, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
            : ''}
        </td>
      </tr></tbody>
    </table>

    {/* Principal's Remark */}
    <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginBottom: GAP, tableLayout: 'fixed' }}>
      <colgroup><col style={{ width: '18%' }} /><col /></colgroup>
      <tbody><tr>
        <td style={labelCell}>Principal's Remark:</td>
        <td style={{ ...valueCell, fontStyle: 'italic', minHeight: 24, lineHeight: 1.5, wordBreak: 'break-word' as const }}>
          {reportCard.principalRemarks || ''}
        </td>
      </tr></tbody>
    </table>

    {/* Principal Name + Signature */}
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: GAP, tableLayout: 'fixed', border: B }}>
      <colgroup>
        <col style={{ width: '18%' }} />
        <col style={{ width: '47%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '27%' }} />
      </colgroup>
      <tbody><tr>
        <td style={labelCell}>Principal's Name:</td>
        <td style={{ ...valueCell, textTransform: 'uppercase', fontWeight: 600 }}>
          {reportCard.principalName || ''}
        </td>
        <td style={labelCell}>Sign:</td>
        <td style={{ ...valueCell, minHeight: SIG_HEIGHT, verticalAlign: 'middle' }}>
          {principalSigSrc
            ? <img src={principalSigSrc} alt="" style={{ height: SIG_HEIGHT, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
            : ''}
        </td>
      </tr></tbody>
    </table>

    {/* Next Term + Date */}
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: GAP, tableLayout: 'fixed', border: B }}>
      <colgroup>
        <col style={{ width: '18%' }} />
        <col style={{ width: '37%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '37%' }} />
      </colgroup>
      <tbody><tr>
        <td style={labelCell}>Next Term Begins:</td>
        <td style={valueCell}>{reportCard.nextTermBegins || ''}</td>
        <td style={labelCell}>Date:</td>
        <td style={valueCell}>{reportCard.dateIssued || new Date().toLocaleDateString()}</td>
      </tr></tbody>
    </table>

    {/* Class Position */}
    <div style={{
      textAlign: 'center', border: B, padding: '7px 0',
      backgroundColor: '#f5f5f5', fontWeight: 900, fontSize: 12, letterSpacing: 0.5,
    }}>
      CLASS POSITION: {formatPosition(reportCard.position)} out of {reportCard.totalStudentsInClass} Students
    </div>

    {/* Footer */}
    <div style={{ textAlign: 'center', fontSize: 7, color: '#666', marginTop: 5, paddingTop: 3, borderTop: '1px solid #ccc' }}>
      <div>{schoolName} &bull; {schoolAddress}</div>
      {schoolMotto && <div style={{ fontStyle: 'italic' }}>"{schoolMotto}"</div>}
    </div>

  </div>
);

export default BottomSection;
