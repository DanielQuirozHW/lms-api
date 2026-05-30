import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CertificatesService } from './certificates.service';
import { CertificateResponseDto, CreateCertificateDto } from './dto/certificate.dto';

@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue (or retrieve existing) certificate for a completed enrollment' })
  @ApiResponse({ status: 201, type: CertificateResponseDto })
  @ApiResponse({ status: 403, description: 'Course not completed or enrollment not owned by user' })
  create(
    @Body() dto: CreateCertificateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CertificateResponseDto> {
    return this.certificatesService.create(dto, user);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all certificates for the current user' })
  @ApiResponse({ status: 200, type: [CertificateResponseDto] })
  findByUser(@CurrentUser() user: AuthenticatedUser): Promise<CertificateResponseDto[]> {
    return this.certificatesService.findByUser(user);
  }

  // NOTE: ':certificateCode/download' declared before ':certificateCode' to prevent
  // NestJS routing 'download' as a parameter value on the single-segment route.
  @Get(':certificateCode/download')
  @Public()
  @ApiOperation({ summary: 'Download certificate as PDF' })
  @ApiResponse({ status: 200, description: 'PDF file stream' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async download(
    @Param('certificateCode') certificateCode: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.certificatesService.generatePdf(certificateCode);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  }

  @Get(':certificateCode')
  @Public()
  @ApiOperation({ summary: 'Get certificate data by verification code (public)' })
  @ApiResponse({ status: 200, type: CertificateResponseDto })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  findByCode(@Param('certificateCode') certificateCode: string): Promise<CertificateResponseDto> {
    return this.certificatesService.findByCode(certificateCode);
  }
}
