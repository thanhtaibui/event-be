import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserResDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/users.dto';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';
import { SortDto } from '../../common/dtos/sort.dto';
import { applySort, applySearch } from "../../common/utils/applySort"
import { paginateArray } from '../../common/utils/paginate-array';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import * as bcrypt from 'bcrypt';
import { Organization } from '../organization/entities/organization.entity';
import { Membership } from '../membership/entities/membership.entity';
import { Role } from '../role/entities/role.entity';
import { DeleteSort } from './dto/delete-sort-user.dto';
@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(Membership) private membershipRepo: Repository<Membership>) { }

  async create(createUserDto: CreateUserDto): Promise<ApiResponse<UserResponseDto>> {
    // check business logic
    const existUser = await this.userRepo.findOne({
      where: { email: createUserDto.email },
    });

    if (existUser) {
      throw new BadRequestException('Email already exists');
    }
    createUserDto.password = await bcrypt.hash(createUserDto.password, 10);
    const user = this.userRepo.create(createUserDto);
    const savedUser = await this.userRepo.save(user);
    const guestOrg = await this.orgRepo.findOne({
      where: { slug: 'guest-organization' },
      relations: ['roles']
    });
    let guestRole: Role | null = null;
    if (guestOrg) {
      // 4. Tìm Role Guest thuộc Organization đó
      guestRole = await this.roleRepo.findOne({
        where: {
          role_name: 'GUEST',
          organization: {
            id: guestOrg.id
          }
        }
      });

      if (guestRole) {
        const membership = this.membershipRepo.create({
          user: savedUser,
          organization: guestOrg,
          role: guestRole,
          isActive: true
        });
        await this.membershipRepo.save(membership);
      }
    }

    // --- KẾT THÚC PHẦN MEMBERSHIP ---

    // 6. Map entity -> response dto
    const result: UserResponseDto = {
      id: savedUser.id,
      email: savedUser.email,
      fullName: savedUser.fullName,
      phoneNumber: savedUser.phoneNumber,
      isActive: savedUser.isActive,
      role: guestRole
        ? [{
          role_name: guestRole.role_name,
          colorKey: guestRole.colorKey,
          orgName: guestOrg?.name || '',
        }]
        : [],
    };

    return Response(201, 'User created successfully', result);
  }

  async findAll(query: SortDto): Promise<ApiResponse<PaginationResult<UserResponseDto>>> {
    const { search, sortBy, sortOrder } = query;
    const users = await this.userRepo.find({
      where: { isDelete: false },
      relations: ['memberships', 'memberships.role', 'memberships.role.organization']
    });
    const filteredData = applySearch(
      users,
      search,
      ['email', 'fullName']
    );
    const sortedData = applySort(
      filteredData,
      sortBy as keyof User,
      sortOrder,
      ['email', 'fullName']
    );
    // Logger.warn("sortedData", sortedData)
    const items = sortedData.map(user => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      isActive: user.isActive,
      role: (user.memberships || [])
        .filter(m => m.role !== null && m.role !== undefined)
        .map((m) => ({
          role_name: m.role.role_name,
          orgName: m.role.organization?.name || 'No Organization',
          colorKey: m.role.colorKey || 'gray'
        }))
    }));

    return Response(
      200,
      'Get all users successfully',
      paginateArray<UserResponseDto>(items, query),

    );

  }

  async update(
    userId: string,
    updateUserDto: UpdateUserDto
  ): Promise<ApiResponse<UpdateUserResDto>> {

    // 1. Check user tồn tại
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Handle memberships (REPLACE)
    if (updateUserDto.memberships) {

      // 2.1 Validate role thuộc org (tránh N+1 có thể tối ưu sau)
      for (const m of updateUserDto.memberships) {
        const roleExists = await this.roleRepo.findOne({
          where: {
            id: m.roleId,
            organization: { id: m.orgId },
          },
        });

        if (!roleExists) {
          throw new BadRequestException(
            `Role ID ${m.roleId} does not belong to Organization ID ${m.orgId}`
          );
        }
      }

      // 2.2 Xóa sạch membership cũ theo FK (QUAN TRỌNG)
      await this.membershipRepo.delete({ user: { id: userId } });

      // 2.3 Tạo data mới bằng FK trực tiếp (KHÔNG dùng relation)
      const newMemberships = updateUserDto.memberships.map((m) =>
        this.membershipRepo.create({
          user: {
            id: userId
          },
          organization: {
            id: m.orgId
          },
          role: { id: m.roleId },
          isActive: true,
        })
      );

      // 2.4 Save lại
      if (newMemberships.length > 0) {
        await this.membershipRepo.save(newMemberships);
      }
    }

    // 3. Update info user
    const { memberships, ...basicInfo } = updateUserDto;

    this.userRepo.merge(user, basicInfo);
    await this.userRepo.save(user);

    // 4. Return full data
    const userSave = await this.userRepo.findOne({
      where: { id: userId },
      relations: [
        'memberships',
        'memberships.organization',
        'memberships.role',
      ],
    });
    const result: UpdateUserResDto = {
      fullName: userSave?.fullName,
      phoneNumber: userSave?.phoneNumber,
      memberships: userSave?.memberships.map((m) => ({
        orgId: m.organization?.id,
        roleId: m.role?.id,
      })),
    }

    return Response(200, 'User updated successfully', result);
  }
  async updateActive(id: string, isActive: boolean): Promise<ApiResponse<UserResponseDto>> {
    const user = await this.findOne(id);
    if (!user) {
      throw new NotFoundException('User not exist');
    }
    user.isActive = isActive
    const savedUser = await this.userRepo.save(user);
    return Response(200, 'User updated Active successfully', savedUser);
  }


  async GetUserById(id: string): Promise<ApiResponse<UserResponseDto>> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['memberships', 'memberships.role', 'memberships.role.organization']
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return Response(200, 'User found successfully', {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      isActive: user.isActive,
      role: (user.memberships || [])
        .filter(m => m.role !== null && m.role !== undefined)
        .map((m) => ({
          role_name: m.role.role_name,
          orgName: m.role.organization?.name || 'No Organization',
          colorKey: m.role.colorKey || 'gray'
        }))
    });
  }
  async findOne(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }


  async deleteSort(deleteSort: DeleteSort): Promise<ApiResponse<DeleteSort>> {
    const users = await this.userRepo.find({ where: { id: In(deleteSort.ids) } })
    if (users.length !== deleteSort.ids.length) {
      throw new BadRequestException("Invalid ids");
    }
    const names = users.map(i => i.fullName);
    await this.userRepo.update(
      { id: In(deleteSort.ids) },
      { isDelete: true },
    );

    return Response(200, `Delete:${names.join(", ")} successfully`, deleteSort)
  }

  // async remove(id: string): Promise<ApiResponse<UserResponseDto>> {
  //   const user = await this.findOne(id);
  //   await this.userRepo.remove(user);

  //   return Response(200, 'User deleted successfully', {
  //     id: user.id,
  //     email: user.email,
  //     fullName: user.fullName,
  //     phoneNumber: user.phoneNumber,
  //     isActive: user.isActive,
  //     role: user.role
  //   });
  // }
}
