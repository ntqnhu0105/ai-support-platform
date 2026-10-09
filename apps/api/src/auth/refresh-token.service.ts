import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RefreshTokenService {
  readonly maxAgeMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const days = Number(config.get('JWT_REFRESH_TTL_DAYS') ?? 7);
    this.maxAgeMs = days * 24 * 60 * 60 * 1000;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Creates a new random token. Only its hash is stored. */
  async issue(userId: string, familyId: string = randomUUID()): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + this.maxAgeMs),
      },
    });
    return token;
  }

  /** Uses a token once: revokes it and issues the next one in the same family. */
  async rotate(token: string): Promise<{ userId: string; familyId: string; token: string }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // A revoked token being presented again means it was copied: kill the whole family.
    if (record.revokedAt) {
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Claim atomically so two simultaneous requests cannot both use the same token.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const next = await this.issue(record.userId, record.familyId);
    return { userId: record.userId, familyId: record.familyId, token: next };
  }

  /** Logout: revoke the whole family this token belongs to. */
  async revoke(token: string): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (record) {
      await this.revokeFamily(record.familyId);
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}