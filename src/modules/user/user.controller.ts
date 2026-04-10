import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/users.dto';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiProperty, ApiOperation } from '@nestjs/swagger';
import { PaginationRequestDto } from '../../common/dtos/pagination_req.dto';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post()
  @ApiProperty({ type: CreateUserDto, })
  @ApiOperation({ operationId: 'createUser' })
  create(@Body() createUserDto: CreateUserDto): Promise<ApiResponse<UserResponseDto>> {
    return this.userService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ operationId: 'getUsers' })
  findAll(@Query() query: PaginationRequestDto): Promise<ApiResponse<PaginationResult<UserResponseDto>>> {
    return this.userService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateUser' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): Promise<ApiResponse<UserResponseDto>> {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteUser' })
  remove(@Param('id') id: string): Promise<ApiResponse<UserResponseDto>> {
    return this.userService.remove(id);
  }
}
