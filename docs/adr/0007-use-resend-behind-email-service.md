# 0007: Use Resend behind an email service

Use Resend as the first transactional email provider because it has a practical free tier and a simple Node.js integration. Application code depends on an internal email service boundary, not Resend directly, so invite delivery can move to Postmark, SES, or another provider later without changing invitation behavior.
