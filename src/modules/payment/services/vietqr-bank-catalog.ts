export interface VietQrBankConfiguration {
  bin: string;
  name: string;
  transferSupported: boolean;
  lookupSupported: boolean;
  accountNumber: {
    numericOnly: true;
    minLength: number;
    maxLength: number;
  };
}

// Transfer-supported BINs from VietQR's public bank directory
// (https://api.vietqr.io/v2/banks). Account bounds
// intentionally match VietQrService's payload constraints and can be narrowed
// per bank when authoritative bank-specific rules become available.
const BANKS: Omit<
  VietQrBankConfiguration,
  'accountNumber' | 'lookupSupported'
>[] = [
  { bin: '970415', name: 'VietinBank', transferSupported: true },
  { bin: '970436', name: 'Vietcombank', transferSupported: true },
  { bin: '970418', name: 'BIDV', transferSupported: true },
  { bin: '970405', name: 'Agribank', transferSupported: true },
  { bin: '970448', name: 'OCB', transferSupported: true },
  { bin: '970422', name: 'MBBank', transferSupported: true },
  { bin: '970407', name: 'Techcombank', transferSupported: true },
  { bin: '970416', name: 'ACB', transferSupported: true },
  { bin: '970432', name: 'VPBank', transferSupported: true },
  { bin: '970423', name: 'TPBank', transferSupported: true },
  { bin: '970403', name: 'Sacombank', transferSupported: true },
  { bin: '970437', name: 'HDBank', transferSupported: true },
  { bin: '970454', name: 'VietCapitalBank', transferSupported: true },
  { bin: '970429', name: 'SCB', transferSupported: true },
  { bin: '970441', name: 'VIB', transferSupported: true },
  { bin: '970443', name: 'SHB', transferSupported: true },
  { bin: '970431', name: 'Eximbank', transferSupported: true },
  { bin: '970426', name: 'MSB', transferSupported: true },
  { bin: '970400', name: 'SaigonBank', transferSupported: true },
  { bin: '970409', name: 'BacABank', transferSupported: true },
  { bin: '970412', name: 'PVcomBank', transferSupported: true },
  { bin: '970414', name: 'MBV', transferSupported: true },
  { bin: '970419', name: 'NCB', transferSupported: true },
  { bin: '970424', name: 'ShinhanBank', transferSupported: true },
  { bin: '970425', name: 'ABBANK', transferSupported: true },
  { bin: '970427', name: 'VietABank', transferSupported: true },
  { bin: '970428', name: 'NamABank', transferSupported: true },
  { bin: '970430', name: 'PGBank', transferSupported: true },
  { bin: '970433', name: 'VietBank', transferSupported: true },
  { bin: '970438', name: 'BaoVietBank', transferSupported: true },
  { bin: '970440', name: 'SeABank', transferSupported: true },
  { bin: '970446', name: 'COOPBANK', transferSupported: true },
  { bin: '970449', name: 'LPBank', transferSupported: true },
  { bin: '970452', name: 'KienLongBank', transferSupported: true },
  { bin: '970434', name: 'IndovinaBank', transferSupported: true },
  { bin: '970444', name: 'CBBank', transferSupported: true },
  { bin: '970457', name: 'Woori', transferSupported: true },
  { bin: '970462', name: 'KookminHN', transferSupported: true },
  { bin: '970463', name: 'KookminHCM', transferSupported: true },
  { bin: '963388', name: 'Timo', transferSupported: true },
  { bin: '971025', name: 'MoMo', transferSupported: true },
  { bin: '422589', name: 'CIMB', transferSupported: true },
];

export const VIETQR_BANKS: ReadonlyMap<string, VietQrBankConfiguration> =
  new Map(
    BANKS.map((bank) => [
      bank.bin,
      {
        ...bank,
        lookupSupported: !['963388', '970462', '970463'].includes(bank.bin),
        accountNumber: { numericOnly: true, minLength: 6, maxLength: 19 },
      },
    ]),
  );
