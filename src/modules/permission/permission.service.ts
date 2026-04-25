import { Injectable, Logger } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { PermissionTreeDto } from './dto/permission.dto';
import { Permission } from './entities/permission.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { IsNull } from "typeorm";
@Injectable()
export class PermissionService {
  constructor(@InjectRepository(Permission) private perRepo: Repository<Permission>) { }

  create(createPermissionDto: CreatePermissionDto) {
    return 'This action adds a new permission';
  }

  async findAll(): Promise<ApiResponse<PermissionTreeDto[]>> {
    const allPermissions = await this.perRepo.find({ relations: ['parent'] });
    const parents = allPermissions.filter(p => !p.parent);
    // 3. Xây dựng cây
    const tree: PermissionTreeDto[] = parents.map((p) => {
      return {
        id: p.id,
        permission_name: p.permission_name,
        children: allPermissions
          .filter(child => child.parent?.id == p.id)
          .map(child => ({
            id: child.id,
            permission_name: child.permission_name,
          }))
      };
    });
    return {
      statusCode: 200,
      message: "Get All Permissions Successfully",
      data: tree
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} permission`;
  }

  update(id: number, updatePermissionDto: UpdatePermissionDto) {
    return `This action updates a #${id} permission`;
  }

  remove(id: number) {
    return `This action removes a #${id} permission`;
  }
}
