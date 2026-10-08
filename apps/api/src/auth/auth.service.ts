import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

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

    return this.toPublicUser(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    const passwordOk = user ? await argon2.verify(user.passwordHash, dto.password) : false;

    // Same message for every failure: never reveal which part was wrong.
    if (!user || !passwordOk || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);

    return { accessToken, user: this.toPublicUser(user) };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer available');
    }
    return this.toPublicUser(user);
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}