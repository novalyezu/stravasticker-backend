import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { createHash } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { and, eq, gt, or } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { sessions, users } from '../database/schema';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
  ) {
    const clientId = this.required('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(clientId);
  }

  async signInWithGoogle(idToken: string) {
    const clientId = this.required('GOOGLE_CLIENT_ID');
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google identity token');
    }

    const existingUser = await this.databaseService.db.query.users.findFirst({
      where: or(
        eq(users.googleSub, payload.sub),
        eq(users.email, payload.email),
      ),
    });

    const now = new Date();
    const userId = existingUser?.id ?? uuidv7();
    const userName = payload.name || payload.email;

    if (!existingUser) {
      await this.databaseService.db.insert(users).values({
        id: userId,
        googleSub: payload.sub,
        email: payload.email,
        name: userName,
        avatarUrl: payload.picture ?? null,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await this.databaseService.db
        .update(users)
        .set({
          googleSub: payload.sub,
          email: payload.email,
          name: userName,
          avatarUrl: payload.picture ?? existingUser.avatarUrl,
          updatedAt: now,
        })
        .where(eq(users.id, existingUser.id));
    }

    const accessToken = await this.createAccessToken(userId, payload.email);
    const refreshToken = await this.createRefreshToken(userId);
    const refreshTokenHash = this.hashToken(refreshToken);

    await this.databaseService.db.insert(sessions).values({
      id: uuidv7(),
      userId,
      refreshTokenHash,
      expiresAt: this.buildRefreshExpiry(),
      createdAt: now,
    });

    const savedUser = await this.databaseService.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!savedUser) {
      throw new InternalServerErrorException('Failed to load signed in user');
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        avatarUrl: savedUser.avatarUrl,
      },
    };
  }

  async refreshSession(refreshToken: string) {
    const refreshSecret = this.required('JWT_REFRESH_SECRET');
    let payload: { sub: string };

    try {
      payload = await this.jwtService.verifyAsync<{ sub: string }>(
        refreshToken,
        {
          secret: refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const hashedToken = this.hashToken(refreshToken);
    const now = new Date();
    const session = await this.databaseService.db.query.sessions.findFirst({
      where: and(
        eq(sessions.userId, payload.sub),
        eq(sessions.refreshTokenHash, hashedToken),
        gt(sessions.expiresAt, now),
      ),
    });

    if (!session) {
      throw new UnauthorizedException('Refresh session not found or expired');
    }

    const user = await this.databaseService.db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user) {
      throw new UnauthorizedException('User not found for refresh token');
    }

    const nextAccessToken = await this.createAccessToken(user.id, user.email);
    const nextRefreshToken = await this.createRefreshToken(user.id);
    const nextRefreshTokenHash = this.hashToken(nextRefreshToken);

    await this.databaseService.db
      .update(sessions)
      .set({
        refreshTokenHash: nextRefreshTokenHash,
        expiresAt: this.buildRefreshExpiry(),
      })
      .where(eq(sessions.id, session.id));

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  private buildRefreshExpiry(): Date {
    const days = Number(
      this.configService.get<string>('JWT_REFRESH_TTL_DAYS') ?? 30,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  private async createAccessToken(
    userId: string,
    email: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: userId,
        email,
      },
      {
        secret: this.required('JWT_ACCESS_SECRET'),
        expiresIn: Number(
          this.configService.get<string>('JWT_ACCESS_EXPIRES_IN_SECONDS') ??
            3600,
        ),
      },
    );
  }

  private async createRefreshToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: userId,
      },
      {
        secret: this.required('JWT_REFRESH_SECRET'),
        expiresIn: Number(
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN_SECONDS') ??
            2_592_000,
        ),
      },
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private required(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`${key} is required`);
    }
    return value;
  }
}
