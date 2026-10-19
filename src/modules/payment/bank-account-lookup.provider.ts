export interface BankAccountLookupInput {
  bankBin: string;
  accountNumber: string;
}

export interface BankAccountLookupResult {
  accountNumber: string;
  accountName: string;
  bankBin: string;
  provider: string;
}

export abstract class BankAccountLookupProvider {
  abstract lookup(
    input: BankAccountLookupInput,
  ): Promise<BankAccountLookupResult>;
}
