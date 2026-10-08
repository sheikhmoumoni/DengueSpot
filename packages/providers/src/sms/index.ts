export interface SmsGateway {
  sendOtp(phoneE164: string, code: string): Promise<void>;
  sendNotification(
    phoneE164: string,
    template: string,
    params: Record<string, string>,
  ): Promise<void>;
}
export class MockSmsGateway implements SmsGateway {
  readonly sent: { kind: "otp" | "notification"; template?: string }[] = [];
  async sendOtp(_phoneE164: string, _code: string) {
    this.sent.push({ kind: "otp" });
  }
  async sendNotification(
    _phoneE164: string,
    template: string,
    _params: Record<string, string>,
  ) {
    this.sent.push({ kind: "notification", template });
  }
}
// Contract endpoint/auth/payload must be supplied by the actual enterprise provider.
export class SslWirelessSmsGateway implements SmsGateway {
  constructor(private transport?: SmsGateway) {}
  async sendOtp(phoneE164: string, code: string) {
    if (!this.transport)
      throw new Error(
        "SSL Wireless enterprise contract adapter is not configured",
      );
    return this.transport.sendOtp(phoneE164, code);
  }
  async sendNotification(
    phoneE164: string,
    template: string,
    params: Record<string, string>,
  ) {
    if (!this.transport)
      throw new Error(
        "SSL Wireless enterprise contract adapter is not configured",
      );
    return this.transport.sendNotification(phoneE164, template, params);
  }
}
export function statusTemplate(
  publicId: string,
  status: string,
  locale: "bn-BD" | "en-BD",
) {
  return locale === "bn-BD"
    ? `আপনার রিপোর্ট ${publicId}: ${status}`
    : `Your report ${publicId}: ${status}`;
}
