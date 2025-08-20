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
    // Handle the callback from Google
    const user = req.user;

    // Store user info and tokens (you might want to use sessions or JWT)
    // For now, we'll redirect with user info
    res.redirect(
      `http://localhost:3001/auth/success?token=${user.accessToken}&userId=${user.email}`,
    );
  }

  @Get('profile')
  getProfile(@Req() req) {
    return req.user;
  }
}
