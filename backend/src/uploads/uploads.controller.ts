import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { PresignedUploadDto } from './dto/presigned-upload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.dto';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned')
  async getPresignedUrl(
    @Body() dto: PresignedUploadDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.uploadsService.generatePresignedUrl(dto, user.sub);
    return { data: result };
  }
}
