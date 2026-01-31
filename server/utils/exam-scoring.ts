/**
 * Exam Scoring Utilities
 * 
 * Auto-scoring functions for exams with AI-assisted theory grading.
 */

export interface TheoryScoreResult {
  score: number;
  confidence: number;
  feedback: string;
  autoScored: boolean;
}

export async function scoreTheoryAnswer(
  studentAnswer: string,
  expectedAnswers: string[],
  sampleAnswer: string | null,
  points: number
): Promise<TheoryScoreResult> {
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return {
      score: 0,
      confidence: 1.0,
      feedback: 'No answer provided.',
      autoScored: true
    };
  }
  
  const studentText = studentAnswer.toLowerCase().trim();

  // Keyword matching (60% weight)
  let keywordScore = 0;
  const matchedKeywords: string[] = [];
  const missedKeywords: string[] = [];

  if (expectedAnswers && expectedAnswers.length > 0) {
    expectedAnswers.forEach(keyword => {
      const keywordLower = keyword.toLowerCase().trim();
      if (studentText.includes(keywordLower)) {
        matchedKeywords.push(keyword);
      } else {
        missedKeywords.push(keyword);
      }
    });
    keywordScore = matchedKeywords.length / expectedAnswers.length;
  }

  // Simple semantic similarity (40% weight)
  let semanticScore = 0;
  if (sampleAnswer && sampleAnswer.trim().length > 0) {
    const sampleWords = sampleAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const studentWords = studentText.split(/\s+/).filter(w => w.length > 3);
    const commonWords = studentWords.filter(word => sampleWords.includes(word));
    semanticScore = sampleWords.length > 0 ? commonWords.length / sampleWords.length : 0;
  } else {
    semanticScore = keywordScore;
  }

  // Hybrid score calculation
  const hybridScore = (keywordScore * 0.6) + (semanticScore * 0.4);
  const calculatedPoints = Math.round(hybridScore * points * 100) / 100;

  // Confidence calculation
  const confidence = Math.min(
    keywordScore > 0.8 ? 0.9 : keywordScore > 0.5 ? 0.7 : 0.5,
    1.0
  );

  // Generate feedback
  let feedback = '';
  if (hybridScore >= 0.8) {
    feedback = `Excellent answer! Key points identified: ${matchedKeywords.join(', ')}. `;
  } else if (hybridScore >= 0.5) {
    feedback = `Good effort. You covered: ${matchedKeywords.join(', ')}. `;
    if (missedKeywords.length > 0) {
      feedback += `Consider including: ${missedKeywords.slice(0, 3).join(', ')}. `;
    }
  } else {
    feedback = `Needs improvement. `;
    if (missedKeywords.length > 0) {
      feedback += `Missing key points: ${missedKeywords.slice(0, 3).join(', ')}. `;
    }
  }

  const shouldAutoScore = confidence >= 0.7 && hybridScore >= 0.3;
  if (!shouldAutoScore) {
    feedback += 'This answer has been flagged for teacher review.';
  }

  return {
    score: shouldAutoScore ? calculatedPoints : 0,
    confidence,
    feedback,
    autoScored: shouldAutoScore
  };
}
