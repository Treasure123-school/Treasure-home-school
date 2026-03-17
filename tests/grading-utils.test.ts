import {
  calculateWeightedScore,
  calculateGradeFromPercentage,
  calculateClassPosition,
  calculateGPA,
  STANDARD_GRADING_SCALE,
  GRADING_SCALES,
  getOrdinalSuffix,
  formatPosition
} from '../shared/grading-utils';

let passedTests = 0;
let failedTests = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passedTests++;
  } catch (error: any) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failedTests++;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeCloseTo(expected: number, precision = 1) {
      const tolerance = Math.pow(10, -precision) * 0.5;
      if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`Expected ${expected} (±${tolerance}) but got ${actual}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (!(actual < expected)) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    }
  };
}

console.log('\n🧪 GRADING UTILITIES TEST SUITE\n');
console.log('=' .repeat(50));

console.log('\n📊 Test: calculateWeightedScore\n');

test('Perfect test (40/40) and exam (60/60) scores yield 100%', () => {
  const result = calculateWeightedScore(40, 40, 60, 60, STANDARD_GRADING_SCALE);
  expect(result.percentage).toBe(100);
  expect(result.grade).toBe('A+');
});

test('50% test (20/40) and 50% exam (30/60) scores yield 50%', () => {
  const result = calculateWeightedScore(20, 40, 30, 60, STANDARD_GRADING_SCALE);
  expect(result.percentage).toBe(50);
  expect(result.grade).toBe('C');
});

test('Zero scores yield 0%', () => {
  const result = calculateWeightedScore(0, 40, 0, 60, STANDARD_GRADING_SCALE);
  expect(result.percentage).toBe(0);
  expect(result.grade).toBe('F');
});

test('Only test score (no exam) calculates correctly', () => {
  const result = calculateWeightedScore(40, 40, null, null, STANDARD_GRADING_SCALE);
  expect(result.percentage).toBe(100);
  expect(result.testWeighted).toBe(40);
  expect(result.examWeighted).toBe(0);
});

test('Only exam score (no test) calculates correctly', () => {
  const result = calculateWeightedScore(null, null, 60, 60, STANDARD_GRADING_SCALE);
  expect(result.percentage).toBe(100);
  expect(result.testWeighted).toBe(0);
  expect(result.examWeighted).toBe(60);
});

test('Weights are correctly 40% test and 60% exam', () => {
  expect(STANDARD_GRADING_SCALE.testWeight).toBe(40);
  expect(STANDARD_GRADING_SCALE.examWeight).toBe(60);
});

console.log('\n📊 Test: calculateGradeFromPercentage\n');

test('90% yields A+', () => {
  const result = calculateGradeFromPercentage(90, 'standard');
  expect(result.grade).toBe('A+');
  expect(result.remarks).toBe('Excellent');
});

test('85% yields A', () => {
  const result = calculateGradeFromPercentage(85, 'standard');
  expect(result.grade).toBe('A');
});

test('75% yields B+', () => {
  const result = calculateGradeFromPercentage(75, 'standard');
  expect(result.grade).toBe('B+');
});

test('65% yields B', () => {
  const result = calculateGradeFromPercentage(65, 'standard');
  expect(result.grade).toBe('B');
});

test('55% yields C', () => {
  const result = calculateGradeFromPercentage(55, 'standard');
  expect(result.grade).toBe('C');
});

test('45% yields D', () => {
  const result = calculateGradeFromPercentage(45, 'standard');
  expect(result.grade).toBe('D');
});

test('35% yields F', () => {
  const result = calculateGradeFromPercentage(35, 'standard');
  expect(result.grade).toBe('F');
  expect(result.remarks).toBe('Fail');
});

test('Boundary: 80% is exactly A', () => {
  const result = calculateGradeFromPercentage(80, 'standard');
  expect(result.grade).toBe('A');
});

test('Boundary: 79% is B+', () => {
  const result = calculateGradeFromPercentage(79, 'standard');
  expect(result.grade).toBe('B+');
});

test('Edge case: 100% yields A+', () => {
  const result = calculateGradeFromPercentage(100, 'standard');
  expect(result.grade).toBe('A+');
});

test('Edge case: 0% yields F', () => {
  const result = calculateGradeFromPercentage(0, 'standard');
  expect(result.grade).toBe('F');
});

test('Negative percentage clamped to 0% (F)', () => {
  const result = calculateGradeFromPercentage(-10, 'standard');
  expect(result.grade).toBe('F');
});

test('Over 100% clamped to 100% (A+)', () => {
  const result = calculateGradeFromPercentage(110, 'standard');
  expect(result.grade).toBe('A+');
});

console.log('\n📊 Test: WAEC Grading Scale\n');

test('WAEC: 80% yields A1', () => {
  const result = calculateGradeFromPercentage(80, 'waec');
  expect(result.grade).toBe('A1');
});

test('WAEC: 50% yields C6', () => {
  const result = calculateGradeFromPercentage(50, 'waec');
  expect(result.grade).toBe('C6');
});

test('WAEC: 35% yields F9', () => {
  const result = calculateGradeFromPercentage(35, 'waec');
  expect(result.grade).toBe('F9');
});

console.log('\n📊 Test: calculateClassPosition\n');

test('Highest average gets position 1', () => {
  const result = calculateClassPosition(90, [90, 80, 70, 60, 50]);
  expect(result.position).toBe(1);
  expect(result.totalStudents).toBe(5);
});

test('Second highest average gets position 2', () => {
  const result = calculateClassPosition(80, [90, 80, 70, 60, 50]);
  expect(result.position).toBe(2);
});

test('Lowest average gets last position', () => {
  const result = calculateClassPosition(50, [90, 80, 70, 60, 50]);
  expect(result.position).toBe(5);
  expect(result.totalStudents).toBe(5);
});

test('Single student in class gets position 1', () => {
  const result = calculateClassPosition(75, [75]);
  expect(result.position).toBe(1);
  expect(result.totalStudents).toBe(1);
});

console.log('\n📊 Test: calculateGPA\n');

test('All A+ grades yield 4.0 GPA', () => {
  const result = calculateGPA(['A+', 'A+', 'A+'], 'standard');
  expect(result).toBe(4.0);
});

test('Mixed grades calculate correct average', () => {
  const result = calculateGPA(['A+', 'B+', 'C'], 'standard');
  expect(result).toBeCloseTo(3.1, 1);
});

test('Empty grades array yields 0 GPA', () => {
  const result = calculateGPA([], 'standard');
  expect(result).toBe(0);
});

console.log('\n📊 Test: Ordinal Suffix\n');

test('1 becomes 1st', () => {
  expect(getOrdinalSuffix(1)).toBe('st');
  expect(formatPosition(1)).toBe('1st');
});

test('2 becomes 2nd', () => {
  expect(getOrdinalSuffix(2)).toBe('nd');
  expect(formatPosition(2)).toBe('2nd');
});

test('3 becomes 3rd', () => {
  expect(getOrdinalSuffix(3)).toBe('rd');
  expect(formatPosition(3)).toBe('3rd');
});

test('4 becomes 4th', () => {
  expect(getOrdinalSuffix(4)).toBe('th');
  expect(formatPosition(4)).toBe('4th');
});

test('11 becomes 11th (not 11st)', () => {
  expect(getOrdinalSuffix(11)).toBe('th');
  expect(formatPosition(11)).toBe('11th');
});

test('21 becomes 21st', () => {
  expect(getOrdinalSuffix(21)).toBe('st');
  expect(formatPosition(21)).toBe('21st');
});

console.log('\n📊 Test: Grading Scales Configuration\n');

test('Standard scale has correct number of ranges', () => {
  expect(STANDARD_GRADING_SCALE.ranges.length).toBe(7);
});

test('WAEC scale has correct number of ranges', () => {
  expect(GRADING_SCALES.waec.ranges.length).toBe(9);
});

test('Percentage scale has correct number of ranges', () => {
  expect(GRADING_SCALES.percentage.ranges.length).toBe(7);
});

test('All scales have same weights (40/60)', () => {
  Object.values(GRADING_SCALES).forEach(scale => {
    expect(scale.testWeight).toBe(40);
    expect(scale.examWeight).toBe(60);
  });
});

console.log('\n' + '=' .repeat(50));
console.log(`\n📈 TEST RESULTS: ${passedTests} passed, ${failedTests} failed\n`);

if (failedTests > 0) {
  process.exit(1);
}
