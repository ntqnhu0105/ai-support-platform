import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Role, User } from '../generated/prisma/client.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    name?: string;
    role?: Role;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }
}