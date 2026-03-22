export interface CompletionField {
  key: string;
  label: string;
  filled: boolean;
  icon: string;
}

export interface CompletionResult {
  percentage: number;
  isComplete: boolean;
  fields: CompletionField[];
  missingFields: CompletionField[];
}

function isFilled(val: unknown): boolean {
  return val != null && String(val).trim() !== '';
}

export function computeProfileCompletion(userData: {
  profileImageUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}): CompletionResult {
  const fields: CompletionField[] = [
    { key: 'profileImageUrl', label: 'Profile Image', filled: isFilled(userData.profileImageUrl), icon: '📷' },
    { key: 'phone', label: 'Phone Number', filled: isFilled(userData.phone), icon: '📞' },
    { key: 'email', label: 'Email Address', filled: isFilled(userData.email), icon: '✉️' },
    { key: 'address', label: 'Home Address', filled: isFilled(userData.address), icon: '🏠' },
  ];

  const filledCount = fields.filter(f => f.filled).length;
  const percentage = Math.round((filledCount / fields.length) * 100);

  return {
    percentage,
    isComplete: percentage === 100,
    fields,
    missingFields: fields.filter(f => !f.filled),
  };
}
