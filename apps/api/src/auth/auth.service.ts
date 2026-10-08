import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service.js';
import type { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: 'CUSTOMER',
    });

    // Never return passwordHash
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}