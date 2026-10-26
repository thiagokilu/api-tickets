import { PartialType } from '@nestjs/swagger';
import { CreateMessageDto } from './create-message.dto.js';

export class UpdateMessageDto extends PartialType(CreateMessageDto) {}
