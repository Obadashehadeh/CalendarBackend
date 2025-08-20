import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    console.log('🚀 Google OAuth initiated');
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
    console.log('📥 Google OAuth callback received');
    console.log('👤 User data:', req.user);

    const user = req.user;

    if (!user || !user.accessToken) {
      console.error('❌ No user or access token received');
      return res.redirect('http://localhost:3001?error=auth_failed');
    }

    // ✅ Fix: Redirect to frontend with token
    const redirectUrl = `http://localhost:3001?token=${user.accessToken}&userId=${user.email}`;
    console.log('🔗 Redirecting to:', redirectUrl.substring(0, 100) + '...');

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