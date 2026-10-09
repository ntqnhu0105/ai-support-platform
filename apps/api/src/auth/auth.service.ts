import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  get refreshCookieMaxAgeMs(): number {
    return this.refreshTokens.maxAgeMs;
  }

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

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user),
      this.refreshTokens.issue(user.id),
    ]);
    return { accessToken, refreshToken, user: this.toPublicUser(user) };
  }

  async refresh(token: string) {
    const rotated = await this.refreshTokens.rotate(token);

    // Re-read the user so role changes and deactivation apply immediately.
    const user = await this.users.findById(rotated.userId);
    if (!user || !user.isActive) {
      await this.refreshTokens.revokeFamily(rotated.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = await this.signAccessToken(user);
    return { accessToken, refreshToken: rotated.token, user: this.toPublicUser(user) };
  }

  async logout(token: string): Promise<void> {
    await this.refreshTokens.revoke(token);
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer available');
    }
    return this.toPublicUser(user);
  }

  private signAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload);
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