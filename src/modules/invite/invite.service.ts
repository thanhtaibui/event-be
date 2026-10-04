import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateInviteDto } from './dto/create-invite.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Invite } from './entities/invite.entity';
import { DataSource, Repository } from 'typeorm';
import { Event } from '../../modules/event/entities/event.entity';
import { InvitationStatus } from 'src/shared/enum/enum';
import { v4 as uuidv4 } from 'uuid';
import { MailerService } from '@nestjs-modules/mailer';
import InviteEmail from 'src/emails/InviteEmail';
import { render } from 'node_modules/@react-email/render/dist/node/index.mjs';
import {
  InviteStatusResDto,
  UpdateInviteStatusDto,
} from './dto/update-status.dto';
import { checkEmailDto, checkEmailResDto } from './dto/chekc-email.dto';
import { validate } from 'deep-email-validator';
import { Membership } from '../membership/entities/membership.entity';

@Injectable()
export class InviteService {
  constructor(
    @InjectRepository(Invite) private readonly inviteRepo: Repository<Invite>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly mailerService: MailerService,
  ) {}

  toVNTime = (date: Date) =>
    date.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  async create(createInviteDto: CreateInviteDto, currentUser?: any): Promise<
    ApiResponse<
      {
        email: string;
        token: string;
      }[]
    >
  > {
    const event = await this.eventRepo.findOne({
      where: { id: createInviteDto.eventId },
      relations: ['organization'],
    });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    await this.assertCanManageEvent(event, currentUser);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invites: {
        email: string;
        token: string;
      }[] = [];
      for (const email of createInviteDto.emailInvite) {
        const token = uuidv4();

        const invite = queryRunner.manager.create(Invite, {
          emailInvite: email,
          event: event,
          token,
          status: InvitationStatus.PENDING,
          message: createInviteDto.message,
        });
        await queryRunner.manager.save(invite);
        invites.push({ email, token });
      }

      // gửi mail sau khi save hết
      for (const invite of invites) {
        const html = await render(
          InviteEmail({
            eventTitle: event.title,
            eventDate:
              this.toVNTime(event.startDateTime) +
              ' - ' +
              this.toVNTime(event.endDateTime),
            regDeadline: this.toVNTime(event.registrationEndDate),
            eventPlace: event.place,
            acceptUrl: `${process.env.FE_URL}/events/accept?token=${invite.token}`,
            rejectUrl: `${process.env.FE_URL}/events/reject?token=${invite.token}`,
            message: createInviteDto.message,
          }),
        );
        await this.mailerService.sendMail({
          to: invite.email,
          subject: `You're invited to ${event.title}`,
          html,
        });
      }

      await queryRunner.commitTransaction();
      return Response(201, 'Invites created successfully', invites);
    } catch (error) {
      // rollback nếu có lỗi
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async checkEmails(
    dto: checkEmailDto,
    currentUser?: any,
  ): Promise<ApiResponse<checkEmailResDto[]>> {
    const event = await this.eventRepo.findOne({
      where: { id: dto.eventId },
      relations: ['organization'],
    });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    await this.assertCanManageEvent(event, currentUser);

    const results = await Promise.allSettled(
      dto.emails.map(async (email): Promise<checkEmailResDto> => {
        const result = await validate({
          email,
          sender: email,
          validateRegex: true,
          validateMx: true,
          validateTypo: true,
          validateDisposable: true,
          validateSMTP: false, // Gmail chặn SMTP nên để false
        });
        if (!result.valid) {
          return { email, status: 'invalid_format' };
        }

        // 2. Check đã invite chưa
        const existing = await this.inviteRepo.findOne({
          where: { emailInvite: email, event: { id: dto.eventId } },
        });
        if (existing) {
          return { email, status: 'already_invited' };
        }

        // 3. Check email tồn tại
        // const res = await fetch(
        //   `https://emailreputation.abstractapi.com/v1/?api_key=${process.env.ABSTRACT_API_KEY}&email=${email}`
        // );
        // const data = await res.json();
        // const deliverability = data.deliverability || data.email_deliverability?.status;
        // if (deliverability?.toLowerCase() !== 'deliverable') {
        //   return { email, status: 'not_exists' };
        // }

        return { email, status: 'valid' };
      }),
    );
    const mapped: checkEmailResDto[] = results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { email: dto.emails[i], status: 'invalid_format' as const },
    );
    return Response(200, 'Check Emails Successfully', mapped);
  }

  async updateStatus(
    token: string,
    dto: UpdateInviteStatusDto,
  ): Promise<ApiResponse<InviteStatusResDto>> {
    if (!Object.values(InvitationStatus).includes(dto.status)) {
      throw new BadRequestException(`Invalid status: ${dto.status}`);
    }
    const invite = await this.inviteRepo.findOne({
      where: { token },
      relations: ['event'],
    });
    if (!invite) {
      throw new BadRequestException('Invite not found');
    }
    if (invite.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        'This invitation is already accepted or rejected.',
      );
    }
    invite.status = dto.status;
    const save = await this.inviteRepo.save(invite);
    const result: InviteStatusResDto = {
      status: save.status,
      event: {
        name: save.event.title,
        date:
          this.toVNTime(save.event.startDateTime) +
          '-' +
          this.toVNTime(save.event.endDateTime),
        location: save.event.place,
      },
    };
    return Response(200, 'Invite status updated successfully', result);
  }

  async findAll(currentUser?: any): Promise<ApiResponse<any[]>> {
    console.time('GET_INVITES');
    try {
      const orgIds = await this.getAccessibleOrganizationIds(currentUser);
      const query = this.inviteRepo
        .createQueryBuilder('invite')
        .leftJoinAndSelect('invite.event', 'event')
        .leftJoinAndSelect('event.organization', 'organization')
        .orderBy('invite.createdAt', 'DESC');

      if (orgIds) {
        if (orgIds.length === 0) {
          return Response(200, 'Get Invites Successfully', []);
        }
        query.where('organization.id IN (:...orgIds)', { orgIds });
      }

      const invites = await query.getMany();
      return Response(
        200,
        'Get Invites Successfully',
        invites.map((invite) => this.toInviteDto(invite)),
      );
    } finally {
      console.timeEnd('GET_INVITES');
    }
  }

  private async getAccessibleOrganizationIds(
    currentUser?: any,
  ): Promise<string[] | null> {
    if (!currentUser || currentUser.role?.isSuperAdmin) {
      return null;
    }

    const memberships = await this.membershipRepo.find({
      where: {
        user: { id: currentUser.userId },
        isActive: true,
      },
      relations: ['organization'],
      select: {
        id: true,
        organization: {
          id: true,
        },
      },
    });

    return memberships
      .map((membership) => membership.organization?.id)
      .filter((id): id is string => Boolean(id));
  }

  async findOne(id: string, currentUser?: any): Promise<ApiResponse<any>> {
    const timer = `GET_INVITE_BY_ID:${id}`;
    console.time(timer);
    try {
      const invite = await this.findInviteById(id);
      await this.assertCanManageEvent(invite.event, currentUser);
      return Response(200, 'Get Invite Successfully', this.toInviteDto(invite));
    } finally {
      console.timeEnd(timer);
    }
  }

  async update(
    id: string,
    updateInviteDto: UpdateInviteDto,
    currentUser?: any,
  ): Promise<ApiResponse<any>> {
    const invite = await this.findInviteById(id);
    await this.assertCanManageEvent(invite.event, currentUser);

    if (updateInviteDto.eventId && updateInviteDto.eventId !== invite.event.id) {
      const event = await this.eventRepo.findOne({
        where: { id: updateInviteDto.eventId },
        relations: ['organization'],
      });
      if (!event) {
        throw new BadRequestException('Event not found');
      }
      await this.assertCanManageEvent(event, currentUser);
      invite.event = event;
    }

    if (updateInviteDto.emailInvite?.length) {
      if (updateInviteDto.emailInvite.length > 1) {
        throw new BadRequestException('Update invite accepts only one email');
      }
      invite.emailInvite = updateInviteDto.emailInvite[0];
    }
    if (updateInviteDto.message !== undefined) {
      invite.message = updateInviteDto.message;
    }

    const saved = await this.inviteRepo.save(invite);
    return Response(200, 'Update Invite Successfully', this.toInviteDto(saved));
  }

  async remove(id: string, currentUser?: any): Promise<ApiResponse<{ id: string }>> {
    const invite = await this.findInviteById(id);
    await this.assertCanManageEvent(invite.event, currentUser);
    await this.inviteRepo.remove(invite);
    return Response(200, 'Delete Invite Successfully', { id });
  }

  private async findInviteById(id: string): Promise<Invite> {
    const invite = await this.inviteRepo.findOne({
      where: { id },
      relations: ['event', 'event.organization'],
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    return invite;
  }

  private async assertCanManageEvent(
    event: Event,
    currentUser?: any,
  ): Promise<void> {
    if (!currentUser || currentUser.role?.isSuperAdmin) {
      return;
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        user: { id: currentUser.userId },
        organization: { id: event.organization.id },
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('User does not belong to this organization');
    }
  }

  private toInviteDto(invite: Invite) {
    return {
      id: invite.id,
      emailInvite: invite.emailInvite,
      status: invite.status,
      token: invite.token,
      message: invite.message,
      createdAt: invite.createdAt,
      event: invite.event
        ? {
            id: invite.event.id,
            title: invite.event.title,
            startDateTime: invite.event.startDateTime,
            endDateTime: invite.event.endDateTime,
            place: invite.event.place,
          }
        : null,
    };
  }
}
