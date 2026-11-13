// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface SystemSettings {
  id?: number;
  schoolName?: string;
  schoolShortName?: string;
  schoolMotto?: string;
  schoolLogo?: string;
  favicon?: string;
  schoolAddress?: string;
  schoolPhones?: string;
  schoolEmails?: string;
  websiteTitle?: string;
  footerText?: string;
  maintenanceMode?: boolean;
  enableSmsNotifications?: boolean;
  enableEmailNotifications?: boolean;
  enableExamsModule?: boolean;
  enableAttendanceModule?: boolean;
  enableResultsModule?: boolean;
  themeColor?: string;
  usernameStudentPrefix?: string;
  usernameParentPrefix?: string;
  usernameTeacherPrefix?: string;
  usernameAdminPrefix?: string;
  tempPasswordFormat?: string;
  hideAdminAccountsFromAdmins?: boolean;
  testWeight?: number;
  examWeight?: number;
  defaultGradingScale?: string;
  scoreAggregationMode?: string;
  autoCreateReportCard?: boolean;
  showGradeBreakdown?: boolean;
  allowTeacherOverrides?: boolean;
  positioningMethod?: string;
  designatedPrincipalId?: string | null;
}

export interface GradingBoundary {
  id: number;
  scaleId?: number | null;
  name: string;
  grade: string;
  minScore: number;
  maxScore: number;
  remark?: string | null;
  gradePoint?: number | null;
  isDefault: boolean;
}

export interface GradeScale {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
  boundaries: GradingBoundary[];
}
