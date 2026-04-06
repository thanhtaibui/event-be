import { Injectable } from '@nestjs/common';
import { CreateEventPostDto } from './dto/create-event-post.dto';
import { UpdateEventPostDto } from './dto/update-event-post.dto';

@Injectable()
export class EventPostService {
  create(createEventPostDto: CreateEventPostDto) {
    return 'This action adds a new eventPost';
  }

  findAll() {
    return `This action returns all eventPost`;
  }

  findOne(id: number) {
    return `This action returns a #${id} eventPost`;
  }

  update(id: number, updateEventPostDto: UpdateEventPostDto) {
    return `This action updates a #${id} eventPost`;
  }

  remove(id: number) {
    return `This action removes a #${id} eventPost`;
  }
}
