import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
    const user = req.user;

    if (!user || !user.accessToken) {
      return res.redirect('http://localhost:3001?error=auth_failed');
    }

    const redirectUrl = `http://localhost:3001?token=${user.accessToken}&userId=${user.email}`;
    res.redirect(redirectUrl);
  }

  @Get('status')
  getStatus() {
    return {
      message: 'Auth module ready',
      googleAuth: 'Google OAuth enabled ✅',
    };
  }
}