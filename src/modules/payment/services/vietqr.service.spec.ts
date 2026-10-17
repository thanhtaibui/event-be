import { BadRequestException } from '@nestjs/common';
import { VietQrService } from './vietqr.service';

describe('VietQrService', () => {
  const service = new VietQrService();

  it('renders a VietQR EMVCo payload to a PNG data URL', async () => {
    const image = await service.createQrDataUrl({
      bankBin: '970422',
      accountNumber: '0123456789',
      accountName: 'NGUYEN VAN A',
      amount: 150000,
      reference: 'EVT1234ABCDEF',
    });
    expect(image).toMatch(/^data:image\/png;base64,/);
    expect(image.length).toBeGreaterThan(500);
  });

  it('places bank BIN and account number in the nested NAPAS beneficiary template', () => {
    const payload = (service as any).buildPayload({
      bankBin: '970422',
      accountNumber: '0123456789',
      accountName: 'NGUYEN VAN A',
      amount: 150000,
      reference: 'EVT1234ABCDEF',
    }) as string;
    expect(payload).toContain('0010A0000007270124');
    expect(payload).toContain('0006970422011001234567890208QRIBFTTA');
    expect(payload).toContain('5406150000');
    expect(payload.slice(-8, -4)).toBe('6304');
  });

  it('rejects invalid account or amount data', async () => {
    await expect(
      service.createQrDataUrl({
        bankBin: 'bank',
        accountNumber: '1234',
        accountName: 'A',
        amount: 1000,
        reference: 'EVT1',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createQrDataUrl({
        bankBin: '970422',
        accountNumber: '123456',
        accountName: 'A',
        amount: 0,
        reference: 'EVT1',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
