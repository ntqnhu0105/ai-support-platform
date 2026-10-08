import type { Request } from 'express';
import type { Role } from '../generated/prisma/client.js';

export interface JwtPayload {
  sub: string; // user id ("subject" theo chuẩn JWT)
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}