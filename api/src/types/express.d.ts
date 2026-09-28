import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      correlationId: string;
      clientId?: string;
      actor?: {
        id: string;
        publicId: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export {};
