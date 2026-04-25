import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Logger,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserResDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/users.dto';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiProperty, ApiOperation } from '@nestjs/swagger';
import { PaginationRequestDto } from '../../common/dtos/pagination_req.dto';
import { SortDto } from '../../common/dtos/sort.dto';

import { PaginationResult } from 'src/common/dtos/pagination.type';
import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { DeleteSort } from './dto/delete-sort-user.dto';
import { UpdateActiveDto } from './dto/updateActiveDto.dto';
import { MembershipService } from '../membership/membership.service';
import { MembershipDto } from '../membership/dto/membership.dto';
// @ApiBearerAuth('access-token')
// @UseGuards(JwtGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService, private readonly membershipService: MembershipService) { }

  @Post()
  @ApiProperty({ type: CreateUserDto, })
  @ApiOperation({ operationId: 'createUser' })
  create(@Body() createUserDto: CreateUserDto): Promise<ApiResponse<UserResponseDto>> {
    return this.userService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ operationId: 'getUsers' })
  findAll(@Query() query: SortDto): Promise<ApiResponse<PaginationResult<UserResponseDto>>> {
    return this.userService.findAll(query);
  }

  @Get(':id')
  GetUserById(@Param('id') id: string): Promise<ApiResponse<UserResponseDto>> {
    return this.userService.GetUserById(id);
  }
  @Get(':userId/organizations')
  @ApiOperation({ operationId: 'getUserOrgs' })
  getUserOrgs(@Param('userId') userId: string): Promise<ApiResponse<MembershipDto[]>> {
    return this.membershipService.findUserOrganizations(userId);
  }
  @Patch(':id/active')
  @ApiOperation({ operationId: 'updateActive' })
  updateActive(@Param('id') id: string, @Body() updateActiveDto: UpdateActiveDto): Promise<ApiResponse<UserResponseDto>> {
    return this.userService.updateActive(id, updateActiveDto.active);
  }

  @Patch('/delete')
  @ApiOperation({ operationId: 'deleteSort' })
  deleteSort(@Body() deleteSort: DeleteSort): Promise<ApiResponse<DeleteSort>> {
    return this.userService.deleteSort(deleteSort);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateUser' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): Promise<ApiResponse<UpdateUserResDto>> {
    return this.userService.update(id, updateUserDto);
  }

  // @Delete(':id')
  // @ApiOperation({ operationId: 'deleteUser' })
  // remove(@Param('id') id: string): Promise<ApiResponse<UserResponseDto>> {
  //   return this.userService.remove(id);
  // }
}
