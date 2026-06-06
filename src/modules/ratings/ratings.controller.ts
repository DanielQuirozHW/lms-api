import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingResponseDto } from './dto/rating-response.dto';
import { RatingSummaryDto } from './dto/rating-summary.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import { RatingsService } from './ratings.service';

@ApiTags('Ratings')
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rate a course (enrolled students only)' })
  @ApiResponse({ status: 201, type: RatingResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRatingDto,
  ): Promise<RatingResponseDto> {
    return this.ratingsService.create(user.id, dto);
  }

  @Patch(':courseId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own course rating' })
  @ApiResponse({ status: 200, type: RatingResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Body() dto: UpdateRatingDto,
  ): Promise<RatingResponseDto> {
    return this.ratingsService.update(user.id, courseId, dto);
  }

  @Get('course/:courseId')
  @Public()
  @ApiOperation({ summary: 'Get all ratings for a course' })
  @ApiResponse({ status: 200, description: 'Paginated ratings list' })
  getRatings(
    @Param('courseId') courseId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<RatingResponseDto>> {
    return this.ratingsService.getRatings(courseId, pagination);
  }

  @Get('course/:courseId/summary')
  @Public()
  @ApiOperation({ summary: 'Get rating summary (average + count + scale)' })
  @ApiResponse({ status: 200, type: RatingSummaryDto })
  getSummary(@Param('courseId') courseId: string): Promise<RatingSummaryDto> {
    return this.ratingsService.getSummary(courseId);
  }
}
