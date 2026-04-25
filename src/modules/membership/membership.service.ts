import { Injectable } from '@nestjs/common';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Membership } from './entities/membership.entity';
import { Repository } from 'typeorm';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { MembershipDto } from './dto/membership.dto';

@Injectable()
export class MembershipService {
  constructor(@InjectRepository(Membership) private membershipRepo: Repository<Membership>) { }

  create(createMembershipDto: CreateMembershipDto) {
    return 'This action adds a new membership';
  }

  findAll() {
    return `This action returns all membership`;
  }

  async findUserOrganizations(userId: string): Promise<ApiResponse<MembershipDto[]>> {
    const memberships = await this.membershipRepo.find({
      where: { user: { id: userId } },
      relations: ['organization', 'role'],
    });

    const result = memberships.map((m) => ({
      userId: userId,
      organizationId: m.organization.id,
      roleId: m.role.id,
      isActive: m.isActive
    }));
    return Response(200, "Get Orgs of User Successfully", result);
  }



  findOne(id: number) {
    return `This action returns a #${id} membership`;
  }

  update(id: number, updateMembershipDto: UpdateMembershipDto) {
    return `This action updates a #${id} membership`;
  }

  remove(id: number) {
    return `This action removes a #${id} membership`;
  }
}
