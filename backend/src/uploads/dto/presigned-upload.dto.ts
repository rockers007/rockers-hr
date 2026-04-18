import { IsNotEmpty, IsString, IsNumber, IsIn, Min } from 'class-validator';

export class PresignedUploadDto {
  @IsNotEmpty()
  @IsString()
  mime_type: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  file_size_bytes: number;

  @IsNotEmpty()
  @IsString()
  @IsIn(['profile_photo', 'resume', 'leave_doc'])
  context: string;
}
