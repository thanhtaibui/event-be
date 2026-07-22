import {
  Entity,
  Column,
  ManyToMany,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from 'src/shared/base/base.entity';
import { Event } from 'src/modules/event/entities/event.entity';

@Entity('categories')
@Index(['name'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class Category extends BaseEntity {
  @ApiProperty({ example: 'Technology' })
  @Column()
  name: string;

  @ApiProperty({ example: 'Category for tech-related events' })
  @Column({ nullable: true, type: 'text' })
  description?: string | null;

  @ManyToMany(() => Event, (event) => event.categories)
  events: Event[];

  @DeleteDateColumn({ name: 'deletedAt', nullable: true })
  deletedAt: Date;
}


