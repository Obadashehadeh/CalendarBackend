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

    // Redirect to frontend with access token
    res.redirect(
      `http://localhost:3001/auth/success?token=${user.accessToken}&userId=${user.email}`,
    );
  }

  @Get('status')
  getStatus() {
    return {
      message: 'Auth module ready',
      googleAuth: 'Google OAuth enabled ✅',
    };
  }
}
