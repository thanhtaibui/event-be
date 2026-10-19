import { BadRequestException, Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { VIETQR_BANKS } from './vietqr-bank-catalog';

@Injectable()
export class VietQrService {
  async createQrDataUrl(input: {
    bankBin: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    reference: string;
  }): Promise<string> {
    if (
      !VIETQR_BANKS.has(input.bankBin) ||
      !/^\d{6,19}$/.test(input.accountNumber)
    ) {
      throw new BadRequestException(
        'Invalid VietQR bank account configuration',
      );
    }
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestException(
        'VietQR amount must be a positive integer in VND',
      );
    }

    const accountName = input.accountName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toUpperCase()
      .slice(0, 25);
    const reference = input.reference
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 25);

    const payload = this.buildPayload({
      ...input,
      accountName,
      reference,
    });
    return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2 });
  }

  private buildPayload(input: {
    bankBin: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    reference: string;
  }): string {
    const beneficiary =
      this.tlv('00', input.bankBin) + this.tlv('01', input.accountNumber);
    const merchantAccount =
      this.tlv('00', 'A000000727') +
      this.tlv('01', beneficiary) +
      this.tlv('02', 'QRIBFTTA');
    const additionalData = this.tlv('08', input.reference);
    const payloadWithoutCrc = [
      this.tlv('00', '01'),
      this.tlv('01', '12'),
      this.tlv('38', merchantAccount),
      this.tlv('52', '0000'),
      this.tlv('53', '704'),
      this.tlv('54', String(input.amount)),
      this.tlv('58', 'VN'),
      this.tlv('59', input.accountName),
      this.tlv('62', additionalData),
      '6304',
    ].join('');
    return `${payloadWithoutCrc}${this.crc16(payloadWithoutCrc)}`;
  }

  private tlv(id: string, value: string): string {
    const length = Buffer.byteLength(value, 'utf8').toString().padStart(2, '0');
    if (length.length !== 2) {
      throw new BadRequestException(`VietQR field ${id} is too long`);
    }
    return `${id}${length}${value}`;
  }

  private crc16(value: string): string {
    let crc = 0xffff;
    for (const byte of Buffer.from(value, 'utf8')) {
      crc ^= byte << 8;
      for (let bit = 0; bit < 8; bit += 1) {
        crc =
          crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
}
