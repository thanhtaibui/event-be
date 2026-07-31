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
  ParseUUIDPipe,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserResDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/users.dto';
import { ApiResponse } from '../../common/utils/ApiResponse';
import { ApiProperty, ApiOperation } from '@nestjs/swagger';
import { PaginationResult } from 'src/common/dtos/pagination.type';
import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { DeleteSort } from './dto/delete-sort-user.dto';
import { UpdateActiveDto } from './dto/updateActiveDto.dto';
import { MemberOfUserDto } from './dto/users.dto';
import { ApiPaginationQuery, FilterOperator, Paginate } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  private assertSuperAdmin(req: any) {
    if (!req.user?.role?.isSuperAdmin) {
      throw new ForbiddenException();
    }
  }

  @Post()
  @ApiProperty({ type: CreateUserDto })
  @ApiOperation({ operationId: 'createUser' })
  create(
    @Req() req: any,
    @Body() createUserDto: CreateUserDto,
  ): Promise<ApiResponse<UserResponseDto>> {
    this.assertSuperAdmin(req);
    return this.userService.create(createUserDto);
  }

  @Get()
  @ApiPaginationQuery({
    sortableColumns: ['email', 'fullName'],
    searchableColumns: ['email', 'fullName'],
    filterableColumns: { isActive: [FilterOperator.EQ] },
  })
  @ApiOperation({ operationId: 'getUsers' })
  findAll(
    @Req() req: any,
    @Paginate() query: PaginateQuery,
  ): Promise<ApiResponse<PaginationResult<UserResponseDto>>> {
    this.assertSuperAdmin(req);
    return this.userService.findAll(query);
  }

  @Get(':id/ticket')
  @ApiOperation({ operationId: 'getUserTickets' })
  getUserTickets(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findTicketsByUser(id);
  }

  @Get(':id')
  GetUserById(@Param('id') id: string): Promise<ApiResponse<UserResponseDto>> {
    return this.userService.GetUserById(id);
  }
  @Get(':userId/organizations')
  @ApiOperation({ operationId: 'getMemberOfUser' })
  getUserOrgs(
    @Param('userId') userId: string,
  ): Promise<ApiResponse<MemberOfUserDto>> {
    return this.userService.findMemberOfUser(userId);
  }
  @Patch(':id/active')
  @ApiOperation({ operationId: 'updateActive' })
  updateActive(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateActiveDto: UpdateActiveDto,
  ): Promise<ApiResponse<UserResponseDto>> {
    this.assertSuperAdmin(req);
    return this.userService.updateActive(id, updateActiveDto.active);
  }

  @Patch('/delete')
  @ApiOperation({ operationId: 'deleteSort' })
  deleteSort(
    @Req() req: any,
    @Body() deleteSort: DeleteSort,
  ): Promise<ApiResponse<DeleteSort>> {
    this.assertSuperAdmin(req);
    return this.userService.deleteSort(deleteSort);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateUser' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ApiResponse<UpdateUserResDto>> {
    this.assertSuperAdmin(req);
    return this.userService.update(id, updateUserDto);
  }

  // @Delete(':id')
  // @ApiOperation({ operationId: 'deleteUser' })
  // remove(@Param('id') id: string): Promise<ApiResponse<UserResponseDto>> {
  //   return this.userService.remove(id);
  // }
}
