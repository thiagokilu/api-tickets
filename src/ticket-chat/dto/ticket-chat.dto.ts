import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendTicketChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
