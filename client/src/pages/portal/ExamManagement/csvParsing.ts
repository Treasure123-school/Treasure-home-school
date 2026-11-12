import { parseCSVWithHeaders } from '@/lib/csvParser';

export function parseCSV(csvContent: string): any[] {

    if (!csvContent || csvContent.trim().length === 0) {
      throw new Error('CSV file is empty. Please provide a valid CSV file with question data.');
    }
    // Parse the whole file as one RFC-4180 document (not line-by-line) so that
    // quoted fields containing embedded line breaks (reading passages, poems,
    // multi-paragraph instructions) are treated as a single field instead of
    // being shredded into extra broken rows.
    const { headers, rows } = parseCSVWithHeaders(csvContent);
    const requiredHeaders = ['QuestionText', 'Type', 'Points'];
    const optionalHeaders = ['OptionA', 'OptionB', 'OptionC', 'OptionD', 'CorrectAnswer', 'Instructions', 'SampleAnswer'];


    // Validate required headers with case-insensitive matching
    const normalizedHeaders = headers.map(h => h.trim());
    const missingRequiredHeaders = requiredHeaders.filter(expected =>
      !normalizedHeaders.some(found => found.toLowerCase() === expected.toLowerCase())
    );

    if (missingRequiredHeaders.length > 0) {
      throw new Error(
        `Missing required CSV headers: ${missingRequiredHeaders.join(', ')}\n\n` +
        `Required headers: ${requiredHeaders.join(', ')}\n` +
        `Optional headers: ${optionalHeaders.join(', ')}\n` +
        `Found headers: ${headers.join(', ')}\n\n` +
        `Please download the template to see the correct format.`
      );
    }
    const questions = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

        if (row.length < headers.length) {
          errors.push(`Row ${i + 2}: Incomplete row (expected ${headers.length} columns, found ${row.length})`);
          continue;
        }
        // Use case-insensitive header matching for robustness
        const getColumnValue = (expectedHeader: string) => {
          const headerIndex = normalizedHeaders.findIndex(h => h.toLowerCase() === expectedHeader.toLowerCase());
          return headerIndex >= 0 ? row[headerIndex]?.trim() : '';
        };

        const questionText = getColumnValue('QuestionText');
        const questionType = getColumnValue('Type')?.toLowerCase().replace(/[-\s]/g, '_');
        const pointsText = getColumnValue('Points');
        const instructions = getColumnValue('Instructions');
        const sampleAnswer = getColumnValue('SampleAnswer');

        // Validate required fields
        if (!questionText || questionText.length < 5) {
          errors.push(`Row ${i + 2}: Question text is required and must be at least 5 characters`);
          continue;
        }
        if (!['multiple_choice', 'essay'].includes(questionType)) {
          errors.push(`Row ${i + 2}: Invalid question type "${questionType}". Please use 'multiple_choice' or 'essay'.`);
          continue;
        }
        const points = parseInt(pointsText) || 1;
        if (points < 1 || points > 100) {
          errors.push(`Row ${i + 2}: Points must be between 1 and 100 (found: ${pointsText})`);
          continue;
        }
        // Validation for essay questions
        if (questionType === 'essay') {
          if (questionText.length < 20) {
            errors.push(`Row ${i + 2}: Essay questions should have detailed question text (at least 20 characters)`);
            continue;
          }
        }

        const question: any = {
          questionText: questionText.trim(),
          questionType,
          points,
          orderNumber: i + 1,
          instructions: instructions?.trim() || null,
          sampleAnswer: sampleAnswer?.trim() || null
        };

        // Handle multiple choice questions
        if (questionType === 'multiple_choice') {
          const correctAnswer = getColumnValue('CorrectAnswer')?.toUpperCase();
          const optionLetters = ['A', 'B', 'C', 'D'];

          if (!optionLetters.includes(correctAnswer)) {
            errors.push(`Row ${i + 2}: Multiple choice questions require correct answer A, B, C, or D (found: "${correctAnswer}")`);
            continue;
          }
          const options = optionLetters.map(letter => ({
            optionText: getColumnValue(`Option${letter}`),
            isCorrect: letter === correctAnswer
          })).filter(opt => opt.optionText && opt.optionText.trim() !== '');

          if (options.length < 2) {
            errors.push(`Row ${i + 2}: Multiple choice questions need at least 2 non-empty options`);
            continue;
          }
          const hasCorrectOption = options.some(opt => opt.isCorrect);
          if (!hasCorrectOption) {
            errors.push(`Row ${i + 2}: The correct answer "${correctAnswer}" doesn't match any provided options`);
            continue;
          }
          question.options = options.map((opt, index) => ({
            ...opt,
            optionText: opt.optionText.trim()
            // orderNumber is automatically set by the backend
          }));
        } else {
          // For text and essay questions, validate that no multiple choice fields are filled
          const hasOptions = ['A', 'B', 'C', 'D'].some(letter => {
            const option = getColumnValue(`Option${letter}`);
            return option && option.trim() !== '';
          });

          if (hasOptions) {
          }
        }

        questions.push(question);
      } catch (rowError: any) {
        errors.push(`Row ${i + 2}: ${rowError.message}`);
      }
    }

    // Report any errors found
    if (errors.length > 0) {
      throw new Error(`Found ${errors.length} error(s) in CSV:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n... and ' + (errors.length - 5) + ' more errors.' : ''}`);
    }
    if (questions.length === 0) {
      throw new Error('No valid questions found in CSV. Please check the format and content.');
    }
    return questions;
  };


  // Helper function to parse CSV line handling quoted content
  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add the last field
    result.push(current.trim());
    return result;
  }
