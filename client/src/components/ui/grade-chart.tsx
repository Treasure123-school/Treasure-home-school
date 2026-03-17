
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GradeChartProps {
  grades: Array<{
    subject: string;
    score: number;
    maxScore: number;
    grade: string;
  }>;
}
export function GradeChart({ grades }: GradeChartProps) {
  const maxPossibleScore = Math.max(...grades.map(g => g.maxScore));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Performance Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {grades.map((grade, index) => {
            const percentage = (grade.score / grade.maxScore) * 100;
            const barColor = percentage >= 80 ? 'bg-green-500' : 
                           percentage >= 70 ? 'bg-blue-500' : 
                           percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500';
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{grade.subject}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold">{grade.score}/{grade.maxScore}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      grade.grade === 'A' || grade.grade === 'A+' ? 'bg-green-100 text-green-800' :
                      grade.grade === 'B' || grade.grade === 'B+' ? 'bg-blue-100 text-blue-800' :
                      grade.grade === 'C' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {grade.grade}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 text-right">{percentage.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
