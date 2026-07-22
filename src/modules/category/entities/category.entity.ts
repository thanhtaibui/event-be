import { Entity, Column, ManyToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from 'src/shared/base/base.entity';
import { Event } from 'src/modules/event/entities/event.entity';

@Entity('categories')
export class Category extends BaseEntity {
  @ApiProperty({ example: 'Technology' })
  @Column({ unique: true })
  name: string;

  @ApiProperty({ example: 'Category for tech-related events' })
  @Column({ nullable: true, type: 'text' })
  description?: string | null;

  @ManyToMany(() => Event, (event) => event.categories)
  events: Event[];
}


