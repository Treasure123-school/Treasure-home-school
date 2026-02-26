
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText, Printer } from 'lucide-react';

interface ReportCardProps {
  student: {
    name: string;
    admissionNumber: string;
    className: string;
    academicSession: string;
  };
  grades: Array<{
    subject: string;
    testScore: number;
    testMax: number;
    examScore: number;
    examMax: number;
    total: number;
    grade: string;
    remarks: string;
  }>;
  summary: {
    totalMarks: number;
    maxMarks: number;
    percentage: number;
    classRank?: number;
    totalStudents?: number;
  };
  teacherSignature?: string;
  principalSignature?: string;
  dateGenerated: string;
}
export function ProfessionalReportCard({ 
  student, 
  grades, 
  summary, 
  teacherSignature, 
  principalSignature, 
  dateGenerated 
}: ReportCardProps) {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'bg-green-100 text-green-800';
      case 'B+':
      case 'B':
        return 'bg-blue-100 text-blue-800';
      case 'C':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const handleExportPDF = () => {
    window.print(); // Simple print to PDF
  };

  const handleExportExcel = () => {
    // Excel export logic would go here
  };

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6 print:bg-blue-900">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              <span className="text-blue-900 font-bold text-xl">🦉</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">{settings?.schoolName || "TREASURE HOME SCHOOL"}</h1>
              <p className="text-blue-100">{settings?.schoolMotto || "Excellence in Education"}</p>
            </div>
          </div>
          <div className="text-right print:hidden">
            <Button variant="secondary" size="sm" onClick={handleExportPDF} className="mr-2">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportExcel}>
              <FileText className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Report Card Title */}
      <div className="bg-gradient-to-r from-cyan-100 to-blue-100 p-4 text-center">
        <h2 className="text-2xl font-bold text-gray-800">STUDENT REPORT CARD</h2>
      </div>

      <div className="p-6">
        {/* Student Information */}
        <Card className="mb-6 border-gray-300">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><span className="font-semibold">Name:</span> {student.name}</p>
                <p><span className="font-semibold">Student ID:</span> {student.admissionNumber}</p>
              </div>
              <div>
                <p><span className="font-semibold">Class:</span> {student.className}</p>
                <p><span className="font-semibold">Academic Session:</span> {student.academicSession}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grades Table */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gradient-to-r from-cyan-50 to-blue-50">
                <th className="border border-gray-300 p-3 text-left font-semibold">Subject</th>
                <th className="border border-gray-300 p-3 text-center font-semibold">Test (40)</th>
                <th className="border border-gray-300 p-3 text-center font-semibold">Exam (60)</th>
                <th className="border border-gray-300 p-3 text-center font-semibold">Total (100)</th>
                <th className="border border-gray-300 p-3 text-center font-semibold">Grade</th>
                <th className="border border-gray-300 p-3 text-center font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((grade, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3 font-medium">{grade.subject}</td>
                  <td className="border border-gray-300 p-3 text-center">{grade.testScore}/{grade.testMax}</td>
                  <td className="border border-gray-300 p-3 text-center">{grade.examScore}/{grade.examMax}</td>
                  <td className="border border-gray-300 p-3 text-center font-semibold">{grade.total}/100</td>
                  <td className="border border-gray-300 p-3 text-center">
                    <Badge className={getGradeColor(grade.grade)}>
                      {grade.grade}
                    </Badge>
                  </td>
                  <td className="border border-gray-300 p-3 text-sm">{grade.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <Card className="mb-6 border-gray-300">
          <CardContent className="p-4">
            <h3 className="font-bold text-lg mb-3">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Marks Obtained:</p>
                <p className="text-xl font-bold">{summary.totalMarks} / {summary.maxMarks}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Overall Percentage:</p>
                <p className="text-xl font-bold text-blue-600">{summary.percentage}%</p>
              </div>
              {summary.classRank && (
                <div>
                  <p className="text-sm text-gray-600">Class Rank:</p>
                  <p className="text-xl font-bold text-green-600">
                    {summary.classRank} of {summary.totalStudents}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Signatures */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div className="text-center">
            <div className="border-b border-gray-400 pb-2 mb-2 h-16 flex items-end justify-center">
              {teacherSignature && (
                <img src={teacherSignature} alt="Teacher Signature" className="h-12" />
              )}
            </div>
            <p className="font-medium">Teacher Signature</p>
            <p className="text-sm text-gray-600">Date Generated: {dateGenerated}</p>
          </div>
          <div className="text-center">
            <div className="border-b border-gray-400 pb-2 mb-2 h-16 flex items-end justify-center">
              {principalSignature && (
                <img src={principalSignature} alt="Principal Signature" className="h-12" />
              )}
            </div>
            <p className="font-medium">Principal/Head Signature</p>
            <p className="text-sm text-gray-600">Dr. S. Chen</p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .max-w-4xl, .max-w-4xl * {
            visibility: visible;
          }
          .max-w-4xl {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
