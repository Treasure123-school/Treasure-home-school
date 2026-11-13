/**
 * Authentication Service
 * Business logic for authentication operations
 * Handles login, password changes, password resets
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { storage } from '../../storage';
import { SECRET_KEY, JWT_EXPIRES_IN } from '../../shared/middleware';

// Validation schemas
const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters')
    .refine(pwd => /[A-Z]/.test(pwd), 'Must contain at least one uppercase letter')
    .refine(pwd => /[a-z]/.test(pwd), 'Must contain at least one lowercase letter')
    .refine(pwd => /[0-9]/.test(pwd), 'Must contain at least one number')
    .refine(pwd => /[!@#$%^&*]/.test(pwd), 'Must contain at least one special character (!@#$%^&*)')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters')
    .refine(pwd => /[A-Z]/.test(pwd), 'Must contain at least one uppercase letter')
    .refine(pwd => /[a-z]/.test(pwd), 'Must contain at least one lowercase letter')
    .refine(pwd => /[0-9]/.test(pwd), 'Must contain at least one number')
    .refine(pwd => /[!@#$%^&*]/.test(pwd), 'Must contain at least one special character (!@#$%^&*)')
});

// Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_RATE_LIMIT_VIOLATIONS = 3;
const LOCKOUT_VIOLATION_WINDOW = 60 * 60 * 1000; // 1 hour
const BCRYPT_ROUNDS = 10;

// In-memory rate limiting (move to Redis in production)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const lockoutViolations = new Map<string, { count: number; timestamps: number[] }>();

export class AuthService {
  /**
   * Login user with username/email and password
   */
  async login(identifier: string, password: string, clientIp: string, userAgent?: string) {
    // Validate input
    loginSchema.parse({ identifier, password });

    const attemptKey = `${clientIp}:${identifier || 'no-identifier'}`;
    const now = Date.now();

    // Clean up old attempts
    this.cleanupOldAttempts(now);

    // Check rate limit
    const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: 0 };
    if (attempts.count >= MAX_LOGIN_ATTEMPTS && (now - attempts.lastAttempt) < RATE_LIMIT_WINDOW) {
      await this.handleRateLimitViolation(identifier, clientIp, now);
    }

    // Find user
    const user = await this.findUserByIdentifier(identifier);
    if (!user) {
      this.incrementLoginAttempts(attemptKey, now);
      throw {
        statusCode: 401,
        message: 'Invalid username or password. Please check your credentials and try again.',
        hint: 'Make sure CAPS LOCK is off and you\'re using the correct username and password.',
        statusType: 'invalid_credentials'
      };
    }

    // Get user role
    const userRole = await storage.getRole(user.roleId);
    const roleName = userRole?.name?.toLowerCase();
    const isStaffAccount = roleName === 'admin' || roleName === 'teacher';

    // Check account status
    this.checkAccountStatus(user, roleName, isStaffAccount);

    // Verify password
    if (!user.passwordHash) {
      if (isStaffAccount && user.authProvider === 'google') {
        throw {
          statusCode: 401,
          message: 'Google Sign-In Required',
          description: 'Please use Google Sign-In for admin/teacher accounts.',
          statusType: 'google_required'
        };
      }
      throw {
        statusCode: 401,
        message: 'Account Setup Incomplete',
        description: 'Your account setup is incomplete. Please contact the school administrator for assistance.',
        statusType: 'setup_incomplete'
      };
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      this.incrementLoginAttempts(attemptKey, now);
      throw {
        statusCode: 401,
        message: 'Invalid Credentials',
        description: 'Invalid username or password. Please check your credentials and try again.',
        statusType: 'invalid_credentials'
      };
    }

    // Password verified - reset rate limits
    loginAttempts.delete(attemptKey);
    lockoutViolations.delete(identifier);

    // Get authorized resources
    const { authorizedClasses, authorizedStudentIds } = await this.getAuthorizedResources(user.id, roleName);

    // Generate JWT token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: roleName,
      authorizedClasses,
      authorizedStudentIds,
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      mustChangePassword: user.mustChangePassword || false,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        profileImageUrl: user.profileImageUrl,
        mustChangePassword: user.mustChangePassword || false,
      }
    };
  }

  /**
   * Change user password (authenticated)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Validate input
    changePasswordSchema.parse({ currentPassword, newPassword });

    // Get user
    const user = await storage.getUser(userId);
    if (!user || !user.passwordHash) {
      throw { statusCode: 404, message: 'User not found' };
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw { statusCode: 401, message: 'Current password is incorrect' };
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password
    await storage.updateUser(userId, {
      passwordHash: newPasswordHash,
      mustChangePassword: false
    });
  }

  /**
   * Request password reset
   */
  async forgotPassword(identifier: string, ipAddress: string, userAgent?: string) {
    // Validate identifier
    z.string().min(1).parse(identifier);

    // Rate limiting (max 3 per hour per identifier)
    const recentAttempts = await storage.getRecentPasswordResetAttempts(identifier, 60);
    if (recentAttempts.length >= 3) {
      await storage.createPasswordResetAttempt(identifier, ipAddress, false);

      // Check for suspicious activity
      const suspiciousAttempts = await storage.getRecentPasswordResetAttempts(identifier, 60);
      if (suspiciousAttempts.length >= 5) {
        await this.lockAccountForSuspiciousActivity(identifier, ipAddress, userAgent);
      }

      throw {
        statusCode: 429,
        message: 'Too many password reset attempts. Please try again later.'
      };
    }

    // Find user
    let user = await storage.getUserByEmail(identifier);
    if (!user) {
      user = await storage.getUserByUsername(identifier);
    }

    // Track attempt
    await storage.createPasswordResetAttempt(identifier, ipAddress, !!user);

    // Don't reveal if user exists
    if (!user) {
      return {
        message: 'If an account exists with that email/username, a password reset link will be sent.'
      };
    }

    // Check if account is locked
    const isLocked = await storage.isAccountLocked(user.id);
    if (isLocked) {
      throw {
        statusCode: 423,
        message: 'Your account is temporarily locked. Please contact the administrator or try again later.'
      };
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save token
    await storage.createPasswordResetToken(user.id, resetToken, expiresAt, ipAddress);

    // Audit log
    await storage.createAuditLog({
      userId: user.id,
      action: 'password_reset_requested',
      entityType: 'user',
      entityId: '0',
      newValue: JSON.stringify({ requestedAt: new Date(), ipAddress }),
      reason: 'User requested password reset',
      ipAddress,
      userAgent: userAgent || null,
    });

    // Send email
    const recoveryEmail = user.recoveryEmail || user.email;
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

    const { sendEmail, getPasswordResetEmailHTML } = await import('../../email-service');
    const emailSent = await sendEmail({
      to: recoveryEmail,
      subject: 'THS Portal - Password Reset Request',
      html: getPasswordResetEmailHTML(`${user.firstName} ${user.lastName}`, resetLink)
    });

    if (!emailSent && process.env.NODE_ENV === 'production') {
      console.error(`❌ Failed to send password reset email to ${recoveryEmail}`);
      throw {
        statusCode: 500,
        message: 'Failed to send password reset email. Please try again later or contact administrator.'
      };
    }

    // Development mode - return token
    if (process.env.NODE_ENV === 'development' && !process.env.RESEND_API_KEY) {
      console.log(`📧 DEV MODE - Password Reset Token: ${resetToken}`);
      console.log(`📧 DEV MODE - Reset Link: ${resetLink}`);

      return {
        message: 'Password reset code generated (Development Mode).',
        developmentMode: true,
        resetToken,
        resetLink,
        email: recoveryEmail,
        expiresIn: '15 minutes',
        instructions: 'Use the resetToken as your reset code, or click the resetLink'
      };
    }

    console.log(`✅ Password reset email sent to ${recoveryEmail} for user ${user.id}`);

    return {
      message: 'If an account exists with that email/username, a password reset link will be sent.'
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string, ipAddress: string, userAgent?: string) {
    // Validate input
    resetPasswordSchema.parse({ token, newPassword });

    // Verify token
    const resetToken = await storage.getPasswordResetToken(token);
    if (!resetToken) {
      throw { statusCode: 400, message: 'Invalid or expired reset token' };
    }

    // Get user
    const user = await storage.getUser(resetToken.userId);
    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password
    await storage.updateUser(resetToken.userId, {
      passwordHash: newPasswordHash,
      mustChangePassword: false
    });

    // Mark token as used
    await storage.markPasswordResetTokenAsUsed(token);

    // Audit log
    await storage.createAuditLog({
      userId: resetToken.userId,
      action: 'password_reset_completed',
      entityType: 'user',
      entityId: '0',
      newValue: JSON.stringify({ completedAt: new Date(), ipAddress }),
      reason: 'Password was successfully reset via reset token',
      ipAddress,
      userAgent: userAgent || null,
    });

    // Send notification email
    const recoveryEmail = user.recoveryEmail || user.email;
    const { sendEmail, getPasswordChangedEmailHTML } = await import('../../email-service');

    await sendEmail({
      to: recoveryEmail,
      subject: 'THS Portal - Password Changed',
      html: getPasswordChangedEmailHTML(`${user.firstName} ${user.lastName}`, ipAddress)
    });

    console.log(`✅ Password reset successfully for user ${resetToken.userId} from IP ${ipAddress}`);
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private cleanupOldAttempts(now: number) {
    for (const [key, data] of Array.from(loginAttempts.entries())) {
      if (now - data.lastAttempt > RATE_LIMIT_WINDOW) {
        loginAttempts.delete(key);
      }
    }
  }

  private incrementLoginAttempts(attemptKey: string, now: number) {
    const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: 0 };
    loginAttempts.set(attemptKey, {
      count: attempts.count + 1,
      lastAttempt: now
    });
  }

  private async handleRateLimitViolation(identifier: string, clientIp: string, now: number) {
    if (!identifier) {
      throw {
        statusCode: 429,
        message: 'Account Temporarily Locked',
        description: 'Too many failed login attempts. Please wait 15 minutes before trying again.',
        statusType: 'rate_limited'
      };
    }

    // Track violation
    const violationData = lockoutViolations.get(identifier) || { count: 0, timestamps: [] };
    const recentViolations = violationData.timestamps.filter((ts: number) => now - ts < LOCKOUT_VIOLATION_WINDOW);
    recentViolations.push(now);
    lockoutViolations.set(identifier, { count: recentViolations.length, timestamps: recentViolations });

    // Suspend account after threshold
    if (recentViolations.length >= MAX_RATE_LIMIT_VIOLATIONS) {
      await this.suspendUserAccount(identifier, clientIp);
    }

    throw {
      statusCode: 429,
      message: 'Account Temporarily Locked',
      description: 'Too many failed login attempts. Your account has been temporarily locked for security reasons. Please wait 15 minutes before trying again, or use \'Forgot Password\' to reset.',
      statusType: 'rate_limited'
    };
  }

  private async suspendUserAccount(identifier: string, clientIp: string) {
    let userToSuspend;
    if (identifier.includes('@')) {
      userToSuspend = await storage.getUserByEmail(identifier);
    } else {
      userToSuspend = await storage.getUserByUsername(identifier);
    }

    if (userToSuspend && userToSuspend.status !== 'suspended') {
      await storage.updateUserStatus(
        userToSuspend.id,
        'suspended',
        'system',
        `Automatic suspension due to ${MAX_RATE_LIMIT_VIOLATIONS} rate limit violations within 1 hour`
      );
      lockoutViolations.delete(identifier);

      const userRole = await storage.getRole(userToSuspend.roleId);
      const roleName = userRole?.name?.toLowerCase();
      
      this.throwSuspensionError(roleName);
    }
  }

  private throwSuspensionError(roleName?: string) {
    const isStaff = roleName === 'admin' || roleName === 'teacher';
    const isParent = roleName === 'parent';

    if (isStaff) {
      throw {
        statusCode: 403,
        message: 'Account Suspended',
        description: 'Access denied. Your account has been suspended by the school administrator due to security concerns.',
        statusType: 'suspended_staff'
      };
    } else if (isParent) {
      throw {
        statusCode: 403,
        message: 'Account Suspended - Security Alert',
        description: 'Your parent account has been automatically suspended due to multiple failed login attempts. This security measure protects your child\'s information from unauthorized access.\n\n📞 To Restore Your Account:\nContact School Administrator:\n📧 Email: treasurehomeschool@gmail.com\n📞 Call: School office during working hours\n\n💡 Have your child\'s information ready for verification.',
        statusType: 'suspended_parent'
      };
    } else {
      throw {
        statusCode: 403,
        message: 'Account Suspended',
        description: 'Your account has been suspended. Please contact your class teacher or the school administrator to resolve this issue.',
        statusType: 'suspended_student'
      };
    }
  }

  private async findUserByIdentifier(identifier: string) {
    if (identifier.includes('@')) {
      return await storage.getUserByEmail(identifier);
    } else {
      let user = await storage.getUserByUsername(identifier);
      if (!user) {
        user = await storage.getUserByEmail(identifier);
      }
      return user;
    }
  }

  private checkAccountStatus(user: any, roleName?: string, isStaffAccount?: boolean) {
    // Check suspended status
    if (user.status === 'suspended') {
      this.throwSuspensionError(roleName);
    }

    // Check pending status
    if (user.status === 'pending') {
      if (isStaffAccount) {
        throw {
          statusCode: 403,
          message: 'Account Pending Approval',
          description: 'Your Admin/Teacher account has been created and is awaiting approval by the school administrator. You will be notified via email once your account is verified.',
          statusType: 'pending_staff'
        };
      } else {
        throw {
          statusCode: 403,
          message: 'Account Pending Setup',
          description: 'Your account is being set up by the school administrator. You will receive a notification once your account is ready.',
          statusType: 'pending_setup'
        };
      }
    }

    // Check disabled status
    if (user.status === 'disabled') {
      throw {
        statusCode: 403,
        message: 'Account Disabled',
        description: 'Your account has been disabled and is no longer active. Please contact the school administrator if you believe this is an error.',
        statusType: 'disabled'
      };
    }

    // Check Google OAuth requirement for staff
    if ((roleName === 'admin' || roleName === 'teacher') && user.authProvider === 'google') {
      throw {
        statusCode: 401,
        message: 'Google Sign-In Required',
        description: 'Admins and Teachers must sign in using their authorized Google account. Please click the \'Sign in with Google\' button below to access your account.',
        statusType: 'google_required'
      };
    }
  }

  private async getAuthorizedResources(userId: string, roleName?: string) {
    let authorizedClasses: string[] = [];
    let authorizedStudentIds: string[] = [];

    // For teachers
    if (roleName === 'teacher') {
      const teacherProfile = await storage.getTeacherProfile(userId);
      if (teacherProfile?.assignedClasses) {
        try {
          const parsed = typeof teacherProfile.assignedClasses === 'string'
            ? JSON.parse(teacherProfile.assignedClasses)
            : teacherProfile.assignedClasses;
          if (Array.isArray(parsed)) {
            authorizedClasses = parsed.map((c: any) => String(c));
          }
        } catch {
          authorizedClasses = [];
        }
      }
    }

    // For students
    if (roleName === 'student') {
      const student = await storage.getStudentByUserId(userId);
      if (student) {
        authorizedStudentIds = [student.id.toString()];
        if (student.classId) {
          authorizedClasses = [student.classId.toString()];
        }
      }
    }

    // For parents
    if (roleName === 'parent') {
      const linkedStudents = await storage.getLinkedStudents(userId);
      if (linkedStudents && linkedStudents.length > 0) {
        authorizedStudentIds = linkedStudents.map((s: any) => s.id.toString());
        authorizedClasses = linkedStudents
          .filter((s: any) => s.classId)
          .map((s: any) => s.classId!.toString());
      }
    }

    return { authorizedClasses, authorizedStudentIds };
  }

  private async lockAccountForSuspiciousActivity(identifier: string, ipAddress: string, userAgent?: string) {
    const user = await storage.getUserByEmail(identifier) || await storage.getUserByUsername(identifier);
    if (user) {
      const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await storage.lockAccount(user.id, lockUntil);
      console.log(`🔒 Account temporarily locked due to suspicious password reset activity: ${user.id}`);

      await storage.createAuditLog({
        userId: user.id,
        action: 'account_locked_suspicious_activity',
        entityType: 'user',
        entityId: '0',
        oldValue: null,
        newValue: JSON.stringify({ reason: 'Excessive password reset attempts', lockUntil }),
        reason: 'Suspicious password reset activity detected',
        ipAddress,
        userAgent: userAgent || null,
      });
    }
  }
}
