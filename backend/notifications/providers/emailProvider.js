class EmailProvider {
  /**
   * Interface for sending an email.
   * Should be implemented by concrete providers like SESProvider or GmailProvider.
   * @param {Object} options
   * @param {string|string[]} options.to - Recipient email address(es)
   * @param {string|string[]} [options.cc] - CC recipient email address(es)
   * @param {string|string[]} [options.bcc] - BCC recipient email address(es)
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content
   * @param {string} [options.idempotencyKey] - Optional sender-provided key for
   *   duplicate suppression on the provider side (e.g. SES Configuration Sets).
   * @returns {Promise<Object>} The result of the email send operation (e.g. messageId)
   */
  async sendEmail(options) {
    throw new Error('sendEmail() must be implemented by concrete EmailProvider');
  }
}

module.exports = EmailProvider;
