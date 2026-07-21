import React from 'react';
import type { ReportCardData } from '../types';
import { B, BL, labelCell, valueCell } from '../styles';

interface StudentInfoProps {
  reportCard: ReportCardData;
  photoSrc: string;
}

const StudentInfo: React.FC<StudentInfoProps> = ({ reportCard, photoSrc }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 5, border: B }}>
    <tbody><tr>
      {/* Student fields (left) */}
      <td style={{ padding: 0, verticalAlign: 'top' }}>
        {/* Row 1–3: name/gender/class/session/admission */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '35%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '35%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td style={labelCell}>NAME:</td>
              <td style={{ ...valueCell, textTransform: 'uppercase', fontWeight: 600 }}>
                {reportCard.studentName.toUpperCase()}
              </td>
              <td style={labelCell}>GENDER:</td>
              <td style={valueCell}>{(reportCard.gender || '-').toUpperCase()}</td>
            </tr>
            <tr>
              <td style={labelCell}>CLASS:</td>
              <td style={valueCell}>
                {reportCard.className}{reportCard.classArm ? ' ' + reportCard.classArm : ''}
              </td>
              <td style={labelCell}>SESSION:</td>
              <td style={valueCell}>{reportCard.academicSession || reportCard.termYear || '2024/2025'}</td>
            </tr>
            <tr>
              <td style={labelCell}>ADMISSION NO:</td>
              <td style={valueCell} colSpan={3}>{reportCard.admissionNumber}</td>
            </tr>
          </tbody>
        </table>

        {/* Row 4: D.O.B | AGE | HT | WT */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '22%' }} />
          </colgroup>
          <tbody><tr>
            <td style={labelCell}>D.O.B.:</td>
            <td style={valueCell}>{reportCard.dateOfBirth || '-'}</td>
            <td style={labelCell}>AGE:</td>
            <td style={valueCell}>{reportCard.age != null ? `${reportCard.age} yrs` : '-'}</td>
            <td style={labelCell}>HT:</td>
            <td style={valueCell}>{reportCard.height || '-'}</td>
            <td style={labelCell}>WT:</td>
            <td style={valueCell}>{reportCard.weight || '-'}</td>
          </tr></tbody>
        </table>

        {/* Row 5: CLUB/SOCIETY | FAV. COL */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '35%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '35%' }} />
          </colgroup>
          <tbody><tr>
            <td style={labelCell}>CLUB/SOCIETY:</td>
            <td style={valueCell}>{reportCard.club || '-'}</td>
            <td style={labelCell}>FAV. COL:</td>
            <td style={valueCell}>{reportCard.favouriteColor || '-'}</td>
          </tr></tbody>
        </table>
      </td>

      {/* Photo (right) */}
      <td style={{ width: 75, verticalAlign: 'top', padding: 5, borderLeft: B }}>
        <div style={{
          width: 64, height: 76, border: B, overflow: 'hidden',
          backgroundColor: '#f8f8f8', textAlign: 'center', lineHeight: '76px',
        }}>
          {photoSrc ? (
            <img
              src={photoSrc} alt="Photo"
              style={{ width: '100%', height: '100%', objectFit: 'cover', verticalAlign: 'middle' }}
            />
          ) : (
            <span style={{ color: '#aaa', fontSize: 8, lineHeight: '76px' }}>Photo</span>
          )}
        </div>
      </td>
    </tr></tbody>
  </table>
);

export default StudentInfo;
