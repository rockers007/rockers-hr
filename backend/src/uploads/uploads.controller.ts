import { Controller, Post, Body, Req } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { PresignedUploadDto } from './dto/presigned-upload.dto';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned')
  async getPresignedUrl(
    @Body() dto: PresignedUploadDto,
    @Req() req: any,
  ) {
    // TODO: Extract userId from JWT once auth module is ready
    const userId = req.user?.id ?? 'anonymous';
    const result = await this.uploadsService.generatePresignedUrl(dto, userId);
    return { data: result };
  }
}
