import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';

export interface ProfileField {
  key: string;
  label: string;
  value: string | null | undefined;
}

export interface ProfileCompletionResult {
  isComplete: boolean;
  percentage: number;
  completedCount: number;
  totalFields: number;
  missingFields: ProfileField[];
  isLoading: boolean;
}

export const TOTAL_PROFILE_FIELDS = 8;

export function buildTrackedFields(student: any): ProfileField[] {
  return [
    { key: 'phone',            label: 'Phone Number',        value: student?.phone },
    { key: 'address',          label: 'Home Address',        value: student?.address },
    { key: 'dateOfBirth',      label: 'Date of Birth',       value: student?.dateOfBirth },
    { key: 'gender',           label: 'Gender',              value: student?.gender },
    { key: 'emergencyContact', label: 'Emergency Contact',   value: student?.emergencyContact },
    { key: 'medicalInfo',      label: 'Medical Information', value: student?.medicalInfo },
    { key: 'recoveryEmail',    label: 'Recovery Email',      value: student?.recoveryEmail },
    { key: 'profileImageUrl',  label: 'Profile Photo',       value: student?.profileImageUrl },
  ];
}

export function computeCompletion(student: any): Omit<ProfileCompletionResult, 'isLoading'> {
  const fields = buildTrackedFields(student);
  const missing = fields.filter(f => !f.value || String(f.value).trim() === '');
  const completedCount = fields.length - missing.length;
  const percentage = Math.round((completedCount / fields.length) * 100);
  return {
    isComplete: missing.length === 0,
    percentage,
    completedCount,
    totalFields: fields.length,
    missingFields: missing,
  };
}

export function useProfileCompletion(): ProfileCompletionResult {
  const { user } = useAuth();

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/students/${user?.id}`);
      if (!response.ok) throw new Error('Failed to fetch student data');
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 0,
  });

  if (!student) {
    return {
      isComplete: false,
      percentage: 0,
      completedCount: 0,
      totalFields: TOTAL_PROFILE_FIELDS,
      missingFields: [],
      isLoading,
    };
  }

  return { ...computeCompletion(student), isLoading: false };
}
