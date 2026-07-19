import React from 'react';
import type { AffectiveTraits, PsychomotorSkills, SubjectScore } from '../types';
import { B, BL, GAP, sectionHeader } from '../styles';

interface RightColumnProps {
  att: { timesSchoolOpened: number; timesPresent: number; timesAbsent: number };
  attPct: number;
  aff: AffectiveTraits;
  psy: PsychomotorSkills;
  gradeCounts: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number>;
  subjectCount: number;
}

const affLabels = [
  { key: 'attentiveness', label: 'Attentiveness' },
  { key: 'honesty', label: 'Honesty' },
  { key: 'neatness', label: 'Neatness' },
  { key: 'politeness', label: 'Politeness' },
  { key: 'punctuality', label: 'Punctuality/Assembly' },
  { key: 'selfControl', label: 'Self Control/ Calmness' },
  { key: 'obedience', label: 'Obedience' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'senseOfResponsibility', label: 'Sense Of Responsibility' },
  { key: 'relationshipWithOthers', label: 'Relationship With Others' },
];

const psyLabels = [
  { key: 'handlingOfTools', label: 'Handling Of Tools' },
  { key: 'drawingPainting', label: 'Drawing/ Painting' },
  { key: 'handwriting', label: 'Handwriting' },
  { key: 'publicSpeaking', label: 'Public Speaking' },
  { key: 'speechFluency', label: 'Speech Fluency' },
  { key: 'sports', label: 'Sports & Games' },
];

/** Rating boxes — inline-block only, no flexbox (html2canvas compatible) */
const RatingBoxes: React.FC<{ value: number | undefined }> = ({ value }) => (
  <td style={{ border: BL, padding: '1px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
    {[5, 4, 3, 2, 1].map(n => (
      <span key={n} style={{
        display: 'inline-block', width: 12, height: 12, border: '1px solid #333',
        fontSize: 7, textAlign: 'center', lineHeight: '12px',
        backgroundColor: value && value >= n ? '#222' : '#fff',
        color: value && value >= n ? '#fff' : '#333',
        fontWeight: 700, verticalAlign: 'middle',
      }}>
        {n}
      </span>
    ))}
  </td>
);

const RightColumn: React.FC<RightColumnProps> = ({
  att, attPct, aff, psy, gradeCounts, subjectCount,
}) => (
  <>
    {/* Attendance Summary */}
    <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginBottom: GAP, tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '68%' }} />
        <col style={{ width: '32%' }} />
      </colgroup>
      <thead><tr><th colSpan={2} style={sectionHeader}>ATTENDANCE SUMMARY</th></tr></thead>
      <tbody>
        <tr>
          <td style={{ padding: '3px 4px', fontSize: 8, borderBottom: BL, verticalAlign: 'middle' }}>No of Times School Opened</td>
          <td style={{ padding: '3px 4px', fontSize: 8, textAlign: 'right', fontWeight: 700, borderBottom: BL, verticalAlign: 'middle' }}>{att.timesSchoolOpened}</td>
        </tr>
        <tr>
          <td style={{ padding: '3px 4px', fontSize: 8, borderBottom: BL, verticalAlign: 'middle' }}>No of Times Present</td>
          <td style={{ padding: '3px 4px', fontSize: 8, textAlign: 'right', fontWeight: 700, borderBottom: BL, verticalAlign: 'middle' }}>
            {att.timesPresent}&ensp;<span style={{ fontSize: 7, fontWeight: 400 }}>({attPct}%)</span>
          </td>
        </tr>
        <tr>
          <td style={{ padding: '3px 4px', fontSize: 8, verticalAlign: 'middle' }}>No of Times Absent</td>
          <td style={{ padding: '3px 4px', fontSize: 8, textAlign: 'right', fontWeight: 700, verticalAlign: 'middle' }}>{att.timesAbsent}</td>
        </tr>
      </tbody>
    </table>

    {/* Affective Domain */}
    <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginBottom: GAP, tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '53%' }} />
        <col style={{ width: '47%' }} />
      </colgroup>
      <thead>
        <tr><th colSpan={2} style={sectionHeader}>AFFECTIVE DOMAIN</th></tr>
        <tr style={{ backgroundColor: '#f5f5f5' }}>
          <th style={{ border: BL, padding: 2, textAlign: 'left', fontSize: 7 }}></th>
          <th style={{ border: BL, padding: 2, fontSize: 7, textAlign: 'center' }}>
            {[5, 4, 3, 2, 1].map(n =>
              <span key={n} style={{ display: 'inline-block', width: 12, textAlign: 'center', fontWeight: 700 }}>{n}</span>
            )}
          </th>
        </tr>
      </thead>
      <tbody>
        {affLabels.map(({ key, label }) => (
          <tr key={key}>
            <td style={{ border: BL, padding: '2px 4px', fontSize: 7, verticalAlign: 'middle', lineHeight: 1.2 }}>{label}</td>
            <RatingBoxes value={aff[key as keyof AffectiveTraits]} />
          </tr>
        ))}
      </tbody>
    </table>

    {/* Psychomotor Domain */}
    <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginBottom: GAP, tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '53%' }} />
        <col style={{ width: '47%' }} />
      </colgroup>
      <thead>
        <tr><th colSpan={2} style={sectionHeader}>PSYCHOMOTOR DOMAIN</th></tr>
        <tr style={{ backgroundColor: '#f5f5f5' }}>
          <th style={{ border: BL, padding: 2, textAlign: 'left', fontSize: 7 }}></th>
          <th style={{ border: BL, padding: 2, fontSize: 7, textAlign: 'center' }}>
            {[5, 4, 3, 2, 1].map(n =>
              <span key={n} style={{ display: 'inline-block', width: 12, textAlign: 'center', fontWeight: 700 }}>{n}</span>
            )}
          </th>
        </tr>
      </thead>
      <tbody>
        {psyLabels.map(({ key, label }) => (
          <tr key={key}>
            <td style={{ border: BL, padding: '2px 4px', fontSize: 7, verticalAlign: 'middle', lineHeight: 1.2 }}>{label}</td>
            <RatingBoxes value={psy[key as keyof PsychomotorSkills]} />
          </tr>
        ))}
      </tbody>
    </table>

    {/* Rating Indices */}
    <div style={{ border: B, padding: '4px 5px', marginBottom: GAP, fontSize: 7, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700, textAlign: 'center', borderBottom: BL, paddingBottom: 2, marginBottom: 2, fontSize: 8 }}>Rating Indices</div>
      <div>5 - Maintains an Excellent degree of Observable traits.</div>
      <div>4 - Maintains a High level of Observable traits.</div>
      <div>3 - Acceptable level of Observable traits.</div>
      <div>2 - Shows Minimal regard for Observable traits.</div>
      <div>1 - Has No regard for Observable traits.</div>
    </div>

    {/* Grade Analysis */}
    <table style={{ width: '100%', borderCollapse: 'collapse', border: B, tableLayout: 'fixed' }}>
      <thead>
        <tr><th colSpan={7} style={sectionHeader}>GRADE ANALYSIS</th></tr>
        <tr style={{ backgroundColor: '#eee' }}>
          {['GRADE', 'A', 'B', 'C', 'D', 'E', 'F'].map(g => (
            <th key={g} style={{ border: B, padding: 2, fontSize: 8, fontWeight: 700, textAlign: 'center', verticalAlign: 'middle' }}>{g}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ border: B, padding: 2, fontSize: 8, textAlign: 'center', fontWeight: 600, verticalAlign: 'middle' }}>No.</td>
          {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map(g => (
            <td key={g} style={{ border: B, padding: 2, fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}>{gradeCounts[g]}</td>
          ))}
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={7} style={{ textAlign: 'center', padding: '3px 0', borderTop: B, fontWeight: 700, fontSize: 8, letterSpacing: 0.3 }}>
            TOTAL SUBJECTS OFFERED: {subjectCount}
          </td>
        </tr>
      </tfoot>
    </table>
  </>
);

export default RightColumn;
