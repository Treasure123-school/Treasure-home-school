import React from 'react';
import type { SubjectScore } from '../types';
import { B, BL, sectionHeader } from '../styles';
import { getRemarkFromGrade } from '../utils';

interface CognitiveDomainProps {
  subjects: SubjectScore[];
  testWeight: number;
  emptyRows: null[];
}

const CognitiveDomain: React.FC<CognitiveDomainProps> = ({ subjects, testWeight, emptyRows }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', border: B, tableLayout: 'fixed' }}>
    <colgroup>
      <col style={{ width: '27%' }} />
      <col style={{ width: '7%' }} />
      <col style={{ width: '8%' }} />
      <col style={{ width: '8%' }} />
      <col style={{ width: '7%' }} />
      <col style={{ width: '8%' }} />
      <col style={{ width: '16%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width: '9%' }} />
    </colgroup>
    <thead>
      <tr><th colSpan={9} style={sectionHeader}>COGNITIVE DOMAIN</th></tr>
      <tr style={{ backgroundColor: '#eee' }}>
        <th rowSpan={2} style={{ border: B, padding: '3px 4px', textAlign: 'left', fontWeight: 700, fontSize: 8 }}>SUBJECTS</th>
        <th style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 8, borderBottom: 'none' }}>C.A</th>
        <th style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 8, borderBottom: 'none' }}>EXAM</th>
        <th style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 8, borderBottom: 'none' }}>TOTAL</th>
        <th rowSpan={2} style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 8 }}>GRADE</th>
        <th rowSpan={2} style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 7 }}>POSITION</th>
        <th rowSpan={2} style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 7 }}>REMARKS</th>
        <th rowSpan={2} style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 7 }}>CLASS AVG</th>
        <th rowSpan={2} style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 7 }}>1st Term</th>
      </tr>
      <tr style={{ backgroundColor: '#eee' }}>
        <th style={{ border: B, padding: '1px', textAlign: 'center', fontWeight: 600, fontSize: 7, borderTop: 'none' }}>{testWeight}</th>
        <th style={{ border: B, padding: '1px', textAlign: 'center', fontWeight: 600, fontSize: 7, borderTop: 'none' }}>100</th>
        <th style={{ border: B, padding: '1px', textAlign: 'center', fontWeight: 600, fontSize: 7, borderTop: 'none' }}>100</th>
      </tr>
    </thead>
    <tbody>
      {subjects.map((s, i) => {
        const t = s.testScore ?? s.testWeightedScore ?? null;
        const e = s.examScore ?? s.examWeightedScore ?? null;
        const tot = s.obtainedMarks || ((Number(t) || 0) + (Number(e) || 0));
        return (
          <tr key={i}>
            <td style={{ border: BL, padding: '3px 4px', fontSize: 8, fontWeight: 500, textTransform: 'uppercase', height: 18, verticalAlign: 'middle', wordBreak: 'break-word', lineHeight: 1.1 }}>{s.subjectName}</td>
            <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}>{t !== null ? t : ''}</td>
            <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}>{e !== null ? e : ''}</td>
            <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', fontWeight: 700, verticalAlign: 'middle' }}>{tot || ''}</td>
            <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', fontWeight: 700, verticalAlign: 'middle' }}>{s.grade || ''}</td>
            <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}>{s.subjectPosition || ''}</td>
            <td style={{ border: BL, padding: '2px', fontSize: 7, textAlign: 'center', fontStyle: 'italic', verticalAlign: 'middle', wordBreak: 'break-word', lineHeight: 1.1 }}>{s.remarks || getRemarkFromGrade(s.grade)}</td>
            <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}>{s.classAverage != null ? s.classAverage : ''}</td>
            <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}></td>
          </tr>
        );
      })}
      {emptyRows.map((_, i) => (
        <tr key={`e${i}`}>
          <td style={{ border: BL, height: 18 }}>&nbsp;</td>
          <td style={{ border: BL }}>&nbsp;</td>
          <td style={{ border: BL }}>&nbsp;</td>
          <td style={{ border: BL }}>&nbsp;</td>
          <td style={{ border: BL }}>&nbsp;</td>
          <td style={{ border: BL }}>&nbsp;</td>
          <td style={{ border: BL }}>&nbsp;</td>
          <td style={{ border: BL }}>&nbsp;</td>
          <td style={{ border: BL }}>&nbsp;</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default CognitiveDomain;
