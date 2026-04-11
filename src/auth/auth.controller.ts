import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { created } from '../common/utils/response';
import { ok } from '../common/utils/response';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async signInWithGoogle(@Body() body: GoogleAuthDto) {
    const result = await this.authService.signInWithGoogle(body.idToken);
    return created(result, 'Signed in');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshTokenDto) {
    const result = await this.authService.refreshSession(body.refreshToken);
    return ok(result, 'Token refreshed');
  }
}
