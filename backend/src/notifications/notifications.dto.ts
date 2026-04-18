import { IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetNotificationsDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_read?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}

export class NotificationResponseDto {
  id: string;
  event_key: string;
  rendered_title: string;
  rendered_body: string;
  channel: string;
  is_read: boolean;
  created_at: Date;
}
