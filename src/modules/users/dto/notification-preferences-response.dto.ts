import { ApiProperty } from '@nestjs/swagger';

export class NotificationPreferencesResponseDto {
  @ApiProperty({ example: true })
  lessonRemindersEmail!: boolean;

  @ApiProperty({ example: true })
  lessonRemindersPush!: boolean;

  @ApiProperty({ example: false })
  newCoursesEmail!: boolean;

  @ApiProperty({ example: true })
  newCoursesPush!: boolean;

  @ApiProperty({ example: true })
  forumRepliesEmail!: boolean;

  @ApiProperty({ example: true })
  forumRepliesPush!: boolean;

  @ApiProperty({ example: true })
  achievementsEmail!: boolean;

  @ApiProperty({ example: true })
  achievementsPush!: boolean;

  @ApiProperty({ example: false })
  platformNewsEmail!: boolean;

  @ApiProperty({ example: false })
  platformNewsPush!: boolean;
}
