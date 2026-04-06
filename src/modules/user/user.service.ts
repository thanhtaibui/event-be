import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/users.dto';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';
import { PaginationRequestDto } from '../../common/dtos/pagination_req.dto';
import { paginateArray } from '../../common/utils/paginate-array';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import * as bcrypt from 'bcrypt';
@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) { }

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
    // map entity -> response dto
    const result: UserResponseDto = {
      email: savedUser.email,
      fullName: savedUser.fullName,
      phoneNumber: savedUser.phoneNumber,
      bio: savedUser.bio,
      isActive: savedUser.isActive,
    };

    return Response(201, 'User created successfully', result);
  }

  async findAll(query: PaginationRequestDto): Promise<ApiResponse<PaginationResult<UserResponseDto>>> {

    const users = await this.userRepo.find();

    const items = users.map(user => ({
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      bio: user.bio,
      isActive: user.isActive,
    }));

    return Response(
      200,
      'Get all users successfully',
      paginateArray<UserResponseDto>(items, query),
    );

  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<ApiResponse<UserResponseDto>> {
    const user = await this.findOne(id);
    if (!user) {
      throw new NotFoundException('User not exist');
    }
    const updatedUser = this.userRepo.merge(user, updateUserDto);
    const savedUser = await this.userRepo.save(updatedUser);
    return Response(200, 'User updated successfully', savedUser);
  }


  async findOne(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
  async remove(id: string): Promise<ApiResponse<UserResponseDto>> {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);

    return Response(200, 'User deleted successfully', {
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      bio: user.bio,
      isActive: user.isActive,
    });
  }
}
