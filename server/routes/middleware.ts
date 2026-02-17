import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { ROLE_IDS as ROLES } from '@shared/role-constants';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roleId: number;
  firstName: string;
  lastName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
    interface User extends AuthenticatedUser {}
  }
}

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-secret-key-change-in-production' : undefined);
if (!JWT_SECRET) {
  process.exit(1);
}
export const SECRET_KEY = JWT_SECRET as string;
export const JWT_EXPIRES_IN = '15m';

export function normalizeUuid(raw: any): string | undefined {
  if (!raw) return undefined;

  if (typeof raw === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }
  let bytes: number[] | undefined;

  if (typeof raw === 'string' && raw.includes(',')) {
    const parts = raw.split(',').map(s => parseInt(s.trim()));
    if (parts.length === 16 && parts.every(n => n >= 0 && n <= 255)) {
      bytes = parts;
    }
  }

  if (Array.isArray(raw) && raw.length === 16) {
    bytes = raw;
  } else if (raw instanceof Uint8Array && raw.length === 16) {
    bytes = Array.from(raw);
  }
  if (bytes) {
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  }
  return undefined;
}

export const authenticateUser = async (req: any, res: any, next: any) => {
  try {
    const authHeader = (req.headers.authorization || '').trim();
    const [scheme, token] = authHeader.split(/\s+/);

    if (!/^bearer$/i.test(scheme) || !token) {
      return res.status(401).json({ message: "Authentication required" });
    }
    let decoded: any;
    try {
      decoded = jwt.verify(token, SECRET_KEY);
    } catch (jwtError) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    const normalizedUserId = normalizeUuid(decoded.userId);
    if (!normalizedUserId) {
      return res.status(401).json({ message: "Invalid token format" });
    }
    const user = await storage.getUser(normalizedUserId);
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }
    if (user.isActive === false) {
      return res.status(401).json({ message: "Account has been deactivated. Please contact administrator." });
    }
    if (user.roleId !== decoded.roleId) {
      return res.status(401).json({ message: "User role has changed, please log in again" });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Authentication failed" });
  }
};

export const authorizeRoles = (...allowedRoles: number[]) => {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!allowedRoles.includes(req.user.roleId)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    } catch (error) {
      res.status(403).json({ message: "Authorization failed" });
    }
  };
};

export { ROLES };
