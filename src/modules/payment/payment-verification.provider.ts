/** Provider-specific adapters must validate the provider signature before returning a transfer. */
export interface VerifiedBankTransfer {
  transactionId: string;
  reference: string;
  amount: number;
  receivingAccountNumber: string;
  occurredAt: Date;
  transferType?: string;
}

export interface SePayWebhookNotification {
  transactionId: string | null;
  reference: string | null;
  amount: number | null;
  receivingAccountNumber: string | null;
  occurredAt: Date | null;
  transferType: string | null;
  idempotencyKey: string;
  payloadSha256: string;
}

export interface PaymentVerificationProvider {
  verifyNotification(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<SePayWebhookNotification>;
}
