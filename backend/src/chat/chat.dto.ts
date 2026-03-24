import { IsString, IsNotEmpty } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ChatMessageResponseDto {
  id: string;
  message: string;
  role: string;
  created_at: Date;
}
