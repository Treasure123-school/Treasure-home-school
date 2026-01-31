/**
 * Report Card Comment Generators
 * 
 * Auto-generates encouraging comments for report cards based on student performance.
 * Uses lastName as per school convention.
 */

function extractLastName(studentName: string): string {
  const nameParts = studentName.trim().split(' ');
  return nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
}

function randomComment(comments: string[]): string {
  return comments[Math.floor(Math.random() * comments.length)];
}

const TEACHER_COMMENTS = {
  excellent: (lastName: string) => [
    `${lastName} has shown exceptional academic performance this term. Keep up the excellent work!`,
    `Outstanding achievement this term! ${lastName} demonstrates strong understanding and dedication to learning.`,
    `${lastName} has maintained an excellent standard throughout this term. A truly commendable performance.`,
  ],
  veryGood: (lastName: string) => [
    `${lastName} has performed very well this term. With a little more effort, excellence is within reach.`,
    `A very good performance from ${lastName}. Continue with the same dedication and aim higher.`,
    `${lastName} shows great potential and has done very well this term. Keep striving for the best.`,
  ],
  good: (lastName: string) => [
    `${lastName} has shown good effort this term. There is room for improvement with more focus and hard work.`,
    `A satisfactory performance from ${lastName}. With extra effort, better results are achievable.`,
    `${lastName} is capable of more. Encourage consistent study habits for improved performance next term.`,
  ],
  fair: (lastName: string) => [
    `${lastName} needs to put in more effort. With additional support and dedication, improvement is possible.`,
    `${lastName} should focus more on studies. Regular revision and asking questions will help improve performance.`,
    `${lastName} has the potential to do better. Extra tutoring and more practice are recommended.`,
  ],
  needsImprovement: (lastName: string) => [
    `${lastName} needs significant improvement. Extra classes and consistent practice are strongly recommended.`,
    `${lastName} should seek additional help and focus on building strong foundations in all subjects.`,
    `${lastName} requires intensive support. Regular study sessions and parent involvement will be beneficial.`,
  ],
};

const PRINCIPAL_COMMENTS = {
  excellent: (lastName: string) => [
    `${lastName} is a model student who consistently demonstrates excellence. The school is proud of this achievement.`,
    `Congratulations to ${lastName} on an outstanding performance. Continue to be an inspiration to others.`,
    `${lastName} has achieved excellent results. We look forward to continued success in future terms.`,
  ],
  veryGood: (lastName: string) => [
    `${lastName} has shown commendable effort and achieved very good results. Keep up the good work.`,
    `Well done to ${lastName} on a very good performance. The potential for excellence is evident.`,
    `${lastName} is on the right track. Continue working hard and aim for even greater heights.`,
  ],
  good: (lastName: string) => [
    `${lastName} has shown satisfactory progress. With increased focus, even better results are attainable.`,
    `We encourage ${lastName} to continue making efforts. The school supports all students on their learning journey.`,
    `${lastName} has the ability to excel. We encourage more dedication to studies next term.`,
  ],
  fair: (lastName: string) => [
    `${lastName} should dedicate more time to academic work. The school will provide necessary support for improvement.`,
    `We urge ${lastName} to take studies more seriously. With proper guidance and effort, improvement is possible.`,
    `${lastName} needs to focus more on academics. We recommend parent-teacher collaboration for support.`,
  ],
  needsImprovement: (lastName: string) => [
    `${lastName} requires immediate academic intervention. We recommend scheduling a meeting to discuss a support plan.`,
    `The school is concerned about ${lastName}'s performance. A structured study plan and monitoring are recommended.`,
    `${lastName} needs intensive academic support. We encourage parents to work closely with teachers for improvement.`,
  ],
};

function getPerformanceLevel(percentage: number): 'excellent' | 'veryGood' | 'good' | 'fair' | 'needsImprovement' {
  if (percentage >= 70) return 'excellent';
  if (percentage >= 60) return 'veryGood';
  if (percentage >= 50) return 'good';
  if (percentage >= 40) return 'fair';
  return 'needsImprovement';
}

export function generateTeacherComment(studentName: string, percentage: number): string {
  const lastName = extractLastName(studentName);
  const level = getPerformanceLevel(percentage);
  return randomComment(TEACHER_COMMENTS[level](lastName));
}

export function generatePrincipalComment(studentName: string, percentage: number): string {
  const lastName = extractLastName(studentName);
  const level = getPerformanceLevel(percentage);
  return randomComment(PRINCIPAL_COMMENTS[level](lastName));
}
