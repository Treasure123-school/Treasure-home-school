/** Auto-split from routes.ts module scope — report-helpers. See git history. */
import * as schema from '@shared/schema.pg';
import { IStorage, db } from '../storage';
import { students } from '@shared/schema.pg';
import { and, eq, isNotNull, ne } from 'drizzle-orm';

export function generateTeacherComment(studentName: string, percentage: number): string {
  // Extract lastName - assuming "FirstName LastName" format, get the last part
  const nameParts = studentName.trim().split(' ');
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

  if (percentage >= 70) {
    // Excellent (A grade)
    const comments = [
      `${lastName} has shown exceptional academic performance this term. Keep up the excellent work!`,
      `Outstanding achievement this term! ${lastName} demonstrates strong understanding and dedication to learning.`,
      `${lastName} has maintained an excellent standard throughout this term. A truly commendable performance.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 60) {
    // Very Good (B grade)
    const comments = [
      `${lastName} has performed very well this term. With a little more effort, excellence is within reach.`,
      `A very good performance from ${lastName}. Continue with the same dedication and aim higher.`,
      `${lastName} shows great potential and has done very well this term. Keep striving for the best.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 50) {
    // Good (C grade)
    const comments = [
      `${lastName} has shown good effort this term. There is room for improvement with more focus and hard work.`,
      `A satisfactory performance from ${lastName}. With extra effort, better results are achievable.`,
      `${lastName} is capable of more. Encourage consistent study habits for improved performance next term.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 40) {
    // Fair (D grade)
    const comments = [
      `${lastName} needs to put in more effort. With additional support and dedication, improvement is possible.`,
      `${lastName} should focus more on studies. Regular revision and asking questions will help improve performance.`,
      `${lastName} has the potential to do better. Extra tutoring and more practice are recommended.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else {
    // Needs Improvement (F grade)
    const comments = [
      `${lastName} needs significant improvement. Extra classes and consistent practice are strongly recommended.`,
      `${lastName} should seek additional help and focus on building strong foundations in all subjects.`,
      `${lastName} requires intensive support. Regular study sessions and parent involvement will be beneficial.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }
}

// ── Resolve the designated principal (name + signature) ──────────────────────
// Priority: 1) designated principal in system settings → 2) admin who signed the
// specific report card (passed as signedById) → 3) first admin → (never superadmin)

export async function resolveDesignatedPrincipal(
  dbParam: typeof db,
  storageParam: IStorage,
  signedById?: string | null
): Promise<{ principalName: string; principalSignatureUrl: string | null }> {
  // 1. Designated principal from system settings
  const settings = await storageParam.getSystemSettings();
  const designatedId = (settings as any)?.designatedPrincipalId as string | null | undefined;
  if (designatedId) {
    const u = await storageParam.getUser(designatedId);
    if (u) {
      const [profile] = await dbParam.select({ signatureUrl: schema.adminProfiles.signatureUrl })
        .from(schema.adminProfiles)
        .where(eq(schema.adminProfiles.userId, designatedId))
        .limit(1);
      return {
        principalName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || '',
        principalSignatureUrl: profile?.signatureUrl || null,
      };
    }
  }

  // 2. Admin who signed this specific report card
  if (signedById) {
    const u = await storageParam.getUser(signedById);
    if (u) {
      const [profile] = await dbParam.select({ signatureUrl: schema.adminProfiles.signatureUrl })
        .from(schema.adminProfiles)
        .where(eq(schema.adminProfiles.userId, signedById))
        .limit(1);
      return {
        principalName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || '',
        principalSignatureUrl: profile?.signatureUrl || null,
      };
    }
  }

  // 3. First admin with a signature
  const [adminWithSig] = await dbParam.select({ userId: schema.adminProfiles.userId, signatureUrl: schema.adminProfiles.signatureUrl })
    .from(schema.adminProfiles)
    .where(and(isNotNull(schema.adminProfiles.signatureUrl), ne(schema.adminProfiles.signatureUrl, '')))
    .limit(1);
  if (adminWithSig) {
    const u = await storageParam.getUser(adminWithSig.userId);
    return {
      principalName: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || '' : '',
      principalSignatureUrl: adminWithSig.signatureUrl || null,
    };
  }

  // 4. Any admin (no signature)
  const [anyAdmin] = await dbParam.select({ userId: schema.adminProfiles.userId })
    .from(schema.adminProfiles)
    .limit(1);
  if (anyAdmin) {
    const u = await storageParam.getUser(anyAdmin.userId);
    return {
      principalName: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || '' : '',
      principalSignatureUrl: null,
    };
  }

  return { principalName: '', principalSignatureUrl: null };
}

// Generate encouraging principal comments based on performance level
// Uses lastName as per school convention

export function generatePrincipalComment(studentName: string, percentage: number): string {
  // Extract lastName - assuming "FirstName LastName" format, get the last part
  const nameParts = studentName.trim().split(' ');
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

  if (percentage >= 70) {
    const comments = [
      `${lastName} is a model student who consistently demonstrates excellence. The school is proud of this achievement.`,
      `Congratulations to ${lastName} on an outstanding performance. Continue to be an inspiration to others.`,
      `${lastName} has achieved excellent results. We look forward to continued success in future terms.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 60) {
    const comments = [
      `${lastName} has shown commendable effort and achieved very good results. Keep up the good work.`,
      `Well done to ${lastName} on a very good performance. The potential for excellence is evident.`,
      `${lastName} is on the right track. Continue working hard and aim for even greater heights.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 50) {
    const comments = [
      `${lastName} has shown satisfactory progress. With increased focus, even better results are attainable.`,
      `We encourage ${lastName} to continue making efforts. The school supports all students on their learning journey.`,
      `${lastName} has the ability to excel. We encourage more dedication to studies next term.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 40) {
    const comments = [
      `${lastName} should dedicate more time to academic work. The school will provide necessary support for improvement.`,
      `We urge ${lastName} to take studies more seriously. With proper guidance and effort, improvement is possible.`,
      `${lastName} needs to focus more on academics. We recommend parent-teacher collaboration for support.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else {
    const comments = [
      `${lastName} requires immediate academic intervention. We recommend scheduling a meeting to discuss a support plan.`,
      `The school is concerned about ${lastName}'s performance. A structured study plan and monitoring are recommended.`,
      `${lastName} needs intensive academic support. We encourage parents to work closely with teachers for improvement.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }
}

