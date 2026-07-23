class EmailProvider {
  /**
   * Interface for sending an email.
   * Should be implemented by concrete providers like SESProvider or BrevoProvider.
   * @param {Object} options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content
   * @returns {Promise<Object>} The result of the email send operation (e.g. messageId)
   */
  async sendEmail(options) {
    throw new Error('sendEmail() must be implemented by concrete EmailProvider');
  }
}

module.exports = EmailProvider;
