import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TicketStatus } from 'src/shared/enum/enum';
import { TicketService } from './ticket.service';

describe('TicketService check-in foundation', () => {
  const organization = { id: 'org-1', name: 'Green Future Community' };
  const event = {
    id: 'event-1',
    title: 'Green Life Festival 2026',
    organization,
  };
  const ticketType = {
    id: 'ticket-type-1',
    name: 'VIP Supporter',
    price: 150000,
    event,
  };
  const user = {
    id: 'user-1',
    fullName: 'Nguyen Van A',
    email: 'user@example.com',
  };
  const managerUser = {
    userId: 'manager-1',
    role: { isSuperAdmin: false, permissions: ['TICKET_MANAGE'] },
  };

  it('creates ticket with VALID status foundation', async () => {
    const { service, userRepo, ticketTypeRepo, ticketRepo } = createService();
    userRepo.findOne.mockResolvedValueOnce(user);
    ticketTypeRepo.findOne.mockResolvedValueOnce(ticketType);
    ticketRepo.create.mockReturnValueOnce({
      id: 'ticket-1',
      user,
      ticketType,
      status: TicketStatus.VALID,
      usedAt: null,
    });
    ticketRepo.save.mockResolvedValueOnce({ id: 'ticket-1' });
    ticketRepo.findOne.mockResolvedValueOnce({
      id: 'ticket-1',
      user,
      ticketType,
      status: TicketStatus.VALID,
      usedAt: null,
      createdAt: new Date('2026-10-20T08:00:00.000Z'),
    });

    const result = await service.create({
      userId: user.id,
      ticketTypeId: ticketType.id,
    });

    expect(ticketRepo.create).toHaveBeenCalledWith({
      user,
      ticketType,
      status: TicketStatus.VALID,
      usedAt: null,
    });
    expect(result.data.status).toBe(TicketStatus.VALID);
    expect(result.data.usedAt).toBeNull();
  });

  it('returns ticket information when verifying a valid ticket', async () => {
    const { service, ticketRepo, membershipRepo } = createService();
    ticketRepo.findOne.mockResolvedValueOnce(makeTicket());
    membershipRepo.findOne.mockResolvedValueOnce({ id: 'membership-1' });

    const result = await service.verifyTicket('ticket-1', managerUser);

    expect(result).toMatchObject({
      success: true,
      data: {
        ticketId: 'ticket-1',
        status: TicketStatus.VALID,
        event: { id: event.id, title: event.title },
        ticketType: { name: ticketType.name, price: ticketType.price },
        owner: { id: user.id, fullName: user.fullName, email: user.email },
      },
    });
  });

  it('returns already used response when verifying a used ticket', async () => {
    const { service, ticketRepo, membershipRepo } = createService();
    ticketRepo.findOne.mockResolvedValueOnce(
      makeTicket({ status: TicketStatus.USED }),
    );
    membershipRepo.findOne.mockResolvedValueOnce({ id: 'membership-1' });

    await expect(service.verifyTicket('ticket-1', managerUser)).resolves.toEqual({
      success: false,
      message: 'Ticket already used',
      status: TicketStatus.USED,
    });
  });

  it('checks in a valid ticket', async () => {
    const { service, ticketRepo, membershipRepo } = createService();
    ticketRepo.findOne.mockResolvedValueOnce(makeTicket());
    membershipRepo.findOne.mockResolvedValueOnce({ id: 'membership-1' });
    ticketRepo.save.mockImplementationOnce(async (ticket) => ticket);

    const result = await service.checkInTicket('ticket-1', managerUser);

    expect(ticketRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ticket-1',
        status: TicketStatus.USED,
        usedAt: expect.any(Date),
      }),
    );
    expect(result).toMatchObject({
      message: 'Check-in successful',
      data: {
        ticketId: 'ticket-1',
        status: TicketStatus.USED,
      },
    });
    expect(result.data.usedAt).toBeInstanceOf(Date);
  });

  it('rejects check-in when ticket is already used', async () => {
    const { service, ticketRepo, membershipRepo } = createService();
    ticketRepo.findOne.mockResolvedValueOnce(
      makeTicket({ status: TicketStatus.USED }),
    );
    membershipRepo.findOne.mockResolvedValueOnce({ id: 'membership-1' });

    await expect(service.checkInTicket('ticket-1', managerUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects check-in when ticket is cancelled', async () => {
    const { service, ticketRepo, membershipRepo } = createService();
    ticketRepo.findOne.mockResolvedValueOnce(
      makeTicket({ status: TicketStatus.CANCELLED }),
    );
    membershipRepo.findOne.mockResolvedValueOnce({ id: 'membership-1' });

    await expect(service.checkInTicket('ticket-1', managerUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects check-in from user outside event organization', async () => {
    const { service, ticketRepo, membershipRepo } = createService();
    ticketRepo.findOne.mockResolvedValueOnce(makeTicket());
    membershipRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.checkInTicket('ticket-1', managerUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects unauthenticated check-in', async () => {
    const { service, ticketRepo } = createService();
    ticketRepo.findOne.mockResolvedValueOnce(makeTicket());

    await expect(service.checkInTicket('ticket-1', undefined)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns 404 when ticket does not exist', async () => {
    const { service, ticketRepo } = createService();
    ticketRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.verifyTicket('missing-ticket', managerUser)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  function makeTicket(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ticket-1',
      createdAt: new Date('2026-10-20T08:00:00.000Z'),
      user,
      ticketType,
      status: TicketStatus.VALID,
      usedAt: null,
      ...overrides,
    };
  }

  function createService() {
    const ticketRepo = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => input),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    const userRepo = { findOne: jest.fn() };
    const ticketTypeRepo = { findOne: jest.fn() };
    const membershipRepo = { findOne: jest.fn() };
    const service = new TicketService(
      ticketRepo as any,
      userRepo as any,
      ticketTypeRepo as any,
      membershipRepo as any,
    );

    return {
      service,
      ticketRepo,
      userRepo,
      ticketTypeRepo,
      membershipRepo,
    };
  }
});
