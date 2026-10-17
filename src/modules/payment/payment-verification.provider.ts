/** Provider-specific adapters must validate the provider signature before returning a transfer. */
export interface VerifiedBankTransfer {
  transactionId: string;
  reference: string;
  amount: number;
  receivingAccountNumber: string;
  occurredAt: Date;
}

export interface PaymentVerificationProvider {
  verifyNotification(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<VerifiedBankTransfer>;
}
