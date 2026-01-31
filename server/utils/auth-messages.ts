export const AUTH_STATUS_TYPES = {
  SUSPENDED_STAFF: "suspended_staff",
  SUSPENDED_PARENT: "suspended_parent", 
  SUSPENDED_STUDENT: "suspended_student",
  RATE_LIMITED: "rate_limited",
} as const;

export interface SuspensionResponse {
  message: string;
  description: string;
  statusType: string;
}

export function getSuspensionMessage(roleName: string | undefined): SuspensionResponse {
  const role = roleName?.toLowerCase();
  
  if (role === "admin" || role === "teacher") {
    return {
      message: "Account Suspended",
      description: "Access denied. Your account has been suspended by the school administrator due to security concerns. Please contact the school administrator to resolve this issue.",
      statusType: AUTH_STATUS_TYPES.SUSPENDED_STAFF,
    };
  }
  
  if (role === "parent") {
    return {
      message: "Account Suspended - Security Alert",
      description: "Your parent account has been automatically suspended due to multiple failed login attempts. This security measure protects your child's information from unauthorized access.\n\n📞 To Restore Your Account:\nContact School Administrator:\n📧 Email: treasurehomeschool@gmail.com\n📞 Call: School office during working hours\n\n💡 Have your child's information ready for verification.",
      statusType: AUTH_STATUS_TYPES.SUSPENDED_PARENT,
    };
  }
  
  return {
    message: "Account Suspended",
    description: "Your account has been suspended. Please contact your class teacher or the school administrator to resolve this issue.",
    statusType: AUTH_STATUS_TYPES.SUSPENDED_STUDENT,
  };
}

export function getRateLimitMessage(): SuspensionResponse {
  return {
    message: "Account Temporarily Locked",
    description: "Too many failed login attempts. Your account has been temporarily locked for security reasons. Please wait 15 minutes before trying again, or use 'Forgot Password' to reset.",
    statusType: AUTH_STATUS_TYPES.RATE_LIMITED,
  };
}

export function getInvalidCredentialsMessage(): { message: string; hint: string } {
  return {
    message: "Invalid username or password. Please check your credentials and try again.",
    hint: "Make sure CAPS LOCK is off and you're using the correct username and password.",
  };
}
