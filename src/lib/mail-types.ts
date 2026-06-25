export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
