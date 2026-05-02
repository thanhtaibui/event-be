import { Injectable } from '@nestjs/common';
import { CreateOrgVerificationDto } from './dto/create-org-verification.dto';
import { UpdateOrgVerificationDto } from './dto/update-org-verification.dto';

@Injectable()
export class OrgVerificationService {
  create(createOrgVerificationDto: CreateOrgVerificationDto) {
    return 'This action adds a new orgVerification';
  }

  findAll() {
    return `This action returns all orgVerification`;
  }

  findOne(id: number) {
    return `This action returns a #${id} orgVerification`;
  }

  update(id: number, updateOrgVerificationDto: UpdateOrgVerificationDto) {
    return `This action updates a #${id} orgVerification`;
  }

  remove(id: number) {
    return `This action removes a #${id} orgVerification`;
  }
}
