import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { REFRESH_COOKIE, refreshCookieOptions } from './auth.cookies.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...body } = await this.auth.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return body;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      const { refreshToken, ...body } = await this.auth.refresh(token);
      this.setRefreshCookie(res, refreshToken);
      return body;
    } catch (error) {
      this.clearRefreshCookie(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof token === 'string' && token.length > 0) {
      await this.auth.logout(token);
    }
    this.clearRefreshCookie(res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return this.auth.me(req.user.sub);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(this.auth.refreshCookieMaxAgeMs));
  }

  private clearRefreshCookie(res: Response): void {
    const { maxAge: _maxAge, ...options } = refreshCookieOptions(0);
    res.clearCookie(REFRESH_COOKIE, options);
  }
}