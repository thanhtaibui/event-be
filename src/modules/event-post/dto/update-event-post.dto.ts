import { PartialType } from '@nestjs/mapped-types';
import { CreateEventPostDto } from './create-event-post.dto';

export class UpdateEventPostDto extends PartialType(CreateEventPostDto) {}
