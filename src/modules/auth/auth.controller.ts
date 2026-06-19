import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from './auth.entity';
import { AuthService } from './auth.service';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const STRICT_THROTTLE = { default: { limit: 5, ttl: 60000 } };
const VERIFY_THROTTLE = { default: { limit: 3, ttl: 600000 } };
const RESET_THROTTLE = { default: { limit: 3, ttl: 3600000 } }; // 3 per hour

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle(STRICT_THROTTLE)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Log in and receive JWT tokens' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'OAuth login or register via Google / Microsoft' })
  @ApiResponse({ status: 200, description: 'Authenticated via OAuth', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  oauth(@Body() dto: OAuthLoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.oauthLogin(dto, ip, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_THROTTLE)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Exchange a refresh token for new token pair' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or revoked' })
  refresh(@Body() dto: RefreshDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RefreshDto): Promise<void> {
    return this.authService.logout(user.id, dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return this.authService.me(user.id);
  }

  @Post('send-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle(VERIFY_THROTTLE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a 6-digit email verification code (returns code for testing)' })
  @ApiResponse({ status: 200, description: 'Verification code generated' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  sendVerification(@CurrentUser() user: AuthenticatedUser): Promise<{ code: string }> {
    return this.authService.sendVerification(user.id);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify email address with the 6-digit code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification code' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  verifyEmail(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyEmailDto): Promise<void> {
    return this.authService.verifyEmail(user.id, dto.code);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(RESET_THROTTLE)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Request a password reset link (returns token for dev/testing)' })
  @ApiResponse({ status: 200, description: 'Reset token generated (if account exists)' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string; resetToken?: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(RESET_THROTTLE)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Reset password using a valid reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Token invalid, expired, or password fails complexity' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
