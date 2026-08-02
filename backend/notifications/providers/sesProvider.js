const EmailProvider = require('./emailProvider');

class SESProvider extends EmailProvider {
  constructor() {
    super();
    // In production, initialize AWS SES Client here:
    // const { SESClient, SendEmailCommand, SendBulkTemplatedEmailCommand } = require("@aws-sdk/client-ses");
    // this.sesClient = new SESClient({ region: process.env.AWS_REGION });
  }

  /**
   * Send an email via SES, supporting consolidated group delivery.
   * Accepts string or string[] for to/cc/bcc and transparently joins them
   * into the comma-separated format SES expects.
   */
  async sendEmail(options) {
    const { to, cc, bcc, subject, html, text, correlationId, idempotencyKey } = options;

    const normalise = (v) => {
      if (!v) return undefined;
      if (Array.isArray(v)) return v.filter(Boolean).join(', ');
      return String(v);
    };
    const toStr = normalise(to);
    const ccStr = normalise(cc);
    const bccStr = normalise(bcc);
    const totalRecipients = [
      ...(Array.isArray(to) ? to : (toStr ? [toStr] : [])),
      ...(Array.isArray(cc) ? cc : (ccStr ? [ccStr] : [])),
      ...(Array.isArray(bcc) ? bcc : (bccStr ? [bccStr] : []))
    ].length;

    console.log(
      `[SESProvider] Sending email` +
      (totalRecipients ? ` to ~${totalRecipients} recipient(s)` : '') +
      ` [Correlation: ${correlationId || 'N/A'}]` +
      (idempotencyKey ? ` [Idem: ${String(idempotencyKey).slice(0, 12)}...]` : '')
    );

    // Mocking SES call for now until credentials are provided
    // In production, this would be:
    // const command = new SendEmailCommand({
    //   Destination: { ToAddresses: toArr, CcAddresses: ccArr, BccAddresses: bccArr },
    //   Message: { ... },
    //   ConfigurationSetName: process.env.SES_CONFIGURATION_SET,
    //   FromEmailAddress: process.env.SES_FROM_ADDRESS
    // });
    // const response = await this.sesClient.send(command);

    // Simulating network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Simulate random failures for testing retry mechanism (10% chance)
    if (Math.random() < 0.1) {
      throw new Error('SES Rate Limit Exceeded or Network Timeout');
    }

    return {
      messageId: `ses-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      provider: 'AWS_SES',
      deliveredTo: totalRecipients
    };
  }
}

module.exports = new SESProvider();
