import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Item } from './entities/item.entity';
import { Repository } from 'typeorm';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { Event } from '../event/entities/event.entity';
import { ItemDto } from './dto/item.dto';

@Injectable()
export class ItemService {
  constructor(@InjectRepository(Item) private readonly itemRope: Repository<Item>,
    @InjectRepository(Event) private readonly eventRope: Repository<Event>) { }

  async create(createItemDto: CreateItemDto): Promise<ApiResponse<CreateItemDto>> {
    const event = await this.eventRope.findOne({ where: { id: createItemDto.eventId } })
    if (!event) {
      throw new BadRequestException("Event Not Exist")
    }
    const item = this.itemRope.create({
      ...createItemDto,
      event: { id: createItemDto.eventId }
    });
    const saveItem = await this.itemRope.save(item)
    const result: CreateItemDto = {
      name: saveItem.name,
      imageUrl: saveItem.imageUrl,
      price: saveItem.price,
      eventId: createItemDto.eventId
    }
    return Response(201, "Create Item Successfully", result);
  }

  async findAll(): Promise<ApiResponse<ItemDto[]>> {
    const items = await this.itemRope.find();
    const result = items.map((i) => ({
      id: i.id,
      name: i.name,
      imageUrl: i.imageUrl,
      price: i.price
    }))
    return Response(200, "Get Items Successfully", result);
  }

  async findOne(id: string): Promise<ApiResponse<ItemDto[]>> {
    const event = await this.eventRope.findOne({ where: { id: id } })
    if (!event) {
      throw new BadRequestException("Event Not Exist")
    }
    const items = await this.itemRope.find({ where: { event: { id: id } } });
    const result = items.map((i) => ({
      id: i.id,
      name: i.name,
      imageUrl: i.imageUrl,
      price: i.price
    }))
    return Response(200, "Get Items of Event Successfully", result);
  }

  async update(id: string, updateItemDto: UpdateItemDto): Promise<ApiResponse<UpdateItemDto>> {

    const item = await this.itemRope.findOne({
      where: { id },
    });

    if (!item) {
      throw new BadRequestException("Item not found");
    }
    const updatedItem = this.itemRope.merge(item, updateItemDto);
    await this.itemRope.save(updatedItem);
    return Response(200, "Update item successfully", updateItemDto);
  }

  async remove(id: string) {
    const item = await this.itemRope.findOne({
      where: { id },
    });

    if (!item) {
      throw new BadRequestException("Item not found");
    }

    await this.itemRope.remove(item);

    return {
      message: "Delete item successfully",
    };
  }
}
