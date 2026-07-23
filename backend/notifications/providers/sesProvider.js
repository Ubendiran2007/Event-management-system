const EmailProvider = require('./emailProvider');

class SESProvider extends EmailProvider {
  constructor() {
    super();
    // In production, initialize AWS SES Client here:
    // const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
    // this.sesClient = new SESClient({ region: process.env.AWS_REGION });
  }

  async sendEmail(options) {
    const { to, subject, html, text, correlationId } = options;
    console.log(`[SESProvider] Sending email to ${to} [Correlation: ${correlationId || 'N/A'}]`);

    // Mocking SES call for now until credentials are provided
    // In production, this would be:
    // const command = new SendEmailCommand({ ... });
    // const response = await this.sesClient.send(command);
    
    // Simulating network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate random failures for testing retry mechanism (10% chance)
    if (Math.random() < 0.1) {
      throw new Error('SES Rate Limit Exceeded or Network Timeout');
    }

    return { 
      messageId: `ses-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      provider: 'AWS_SES'
    };
  }
}

module.exports = new SESProvider();
