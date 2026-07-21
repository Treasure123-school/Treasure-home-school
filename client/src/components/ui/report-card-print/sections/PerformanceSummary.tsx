import React from 'react';
import { B, BL, GAP, sectionHeader } from '../styles';
import { getRemarkFromGrade } from '../utils';

interface PerformanceSummaryProps {
  totalObtained: number;
  totalMax: number;
  avgPct: number;
  overallGrade: string;
}

const PerformanceSummary: React.FC<PerformanceSummaryProps> = ({
  totalObtained, totalMax, avgPct, overallGrade,
}) => (
  <>
    {/* Performance Summary */}
    <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginTop: GAP, tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '28%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '44%' }} />
      </colgroup>
      <thead>
        <tr><th colSpan={4} style={sectionHeader}>PERFORMANCE SUMMARY</th></tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ padding: '4px 6px', fontSize: 9, borderRight: BL, verticalAlign: 'middle' }}>Total Obtained:</td>
          <td style={{ padding: '4px 4px', fontSize: 10, fontWeight: 700, borderRight: BL, verticalAlign: 'middle' }}>{totalObtained}</td>
          <td style={{ padding: '4px 4px', fontSize: 9, borderRight: BL, verticalAlign: 'middle' }}>%TAGE:</td>
          <td rowSpan={2} style={{ padding: '4px', fontSize: 22, fontWeight: 900, textAlign: 'center', verticalAlign: 'middle', lineHeight: 1 }}>
            {avgPct}%
          </td>
        </tr>
        <tr>
          <td style={{ padding: '4px 6px', fontSize: 9, borderRight: BL, borderTop: BL, verticalAlign: 'middle' }}>Total Obtainable:</td>
          <td style={{ padding: '4px 4px', fontSize: 10, fontWeight: 700, borderRight: BL, borderTop: BL, verticalAlign: 'middle' }}>{totalMax}</td>
          <td style={{ padding: '4px 4px', fontSize: 9, borderRight: BL, borderTop: BL, verticalAlign: 'middle' }}>GRADE:</td>
        </tr>
        <tr>
          <td colSpan={3} style={{ borderTop: B }}></td>
          <td style={{ padding: '3px 4px', fontSize: 22, fontWeight: 900, textAlign: 'center', borderTop: B, lineHeight: 1, verticalAlign: 'middle' }}>
            {overallGrade}
          </td>
        </tr>
        <tr>
          <td colSpan={4} style={{ textAlign: 'center', padding: '5px 0', borderTop: B, fontWeight: 700, fontSize: 10, letterSpacing: 0.5, verticalAlign: 'middle' }}>
            {getRemarkFromGrade(overallGrade)}
          </td>
        </tr>
      </tbody>
    </table>

    {/* Grade Scale */}
    <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginTop: GAP }}>
      <thead><tr><th style={sectionHeader}>GRADE SCALE</th></tr></thead>
      <tbody><tr>
        <td style={{ padding: '4px 6px', fontSize: 7, textAlign: 'center', lineHeight: 1.5 }}>
          70-100%=A(EXCELLENT)&ensp;60-69.9%=B(VERY GOOD)&ensp;50-59.9%=C(GOOD)&ensp;40-49.9%=D(PASS)&ensp;30-39.9%=E(FAIR)&ensp;0-29.9%=F(WEAK)
        </td>
      </tr></tbody>
    </table>
  </>
);

export default PerformanceSummary;
