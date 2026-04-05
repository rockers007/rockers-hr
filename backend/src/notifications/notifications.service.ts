import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { MasterNotificationTemplate } from '../master/entities/master-notification-template.entity';
import * as nodemailer from 'nodemailer';

export interface DispatchRecipient {
  userId: string;
  email: string;
  fcmToken?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(MasterNotificationTemplate)
    private readonly templateRepo: Repository<MasterNotificationTemplate>,
  ) {
    this.initSmtp();
  }

  private initSmtp(): void {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      this.logger.warn('SMTP not configured — email notifications will be skipped');
      return;
    }

    const portNum = port ? parseInt(port, 10) : 587;
    this.transporter = nodemailer.createTransport({
      host,
      port: portNum,
      secure: portNum === 465, // true for 465 (implicit SSL), false for 587 (STARTTLS)
      auth: { user, pass },
    });
  }

  renderTemplate(template: string, tokens: Record<string, string>): string {
    return template.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => tokens[key] ?? `{{${key}}}`,
    );
  }

  async dispatch(
    eventKey: string,
    recipients: DispatchRecipient[],
    tokens: Record<string, string>,
  ): Promise<void> {
    const template = await this.templateRepo.findOne({
      where: { event_key: eventKey, is_active: true },
    });

    if (!template) {
      this.logger.warn(`No active template found for event_key: ${eventKey}`);
      return;
    }

    const renderedTitle = template.subject_template
      ? this.renderTemplate(template.subject_template, tokens)
      : eventKey;
    const renderedBody = this.renderTemplate(template.body_template, tokens);

    for (const recipient of recipients) {
      // Create in-app notification
      if (template.channel === 'in_app' || template.channel === 'both') {
        const notification = this.notificationRepo.create({
          user_id: recipient.userId,
          template_id: template.id,
          event_key: eventKey,
          rendered_title: renderedTitle,
          rendered_body: renderedBody,
          channel: template.channel,
        });
        await this.notificationRepo.save(notification);
      }

      // Send email
      if (template.channel === 'email' || template.channel === 'both') {
        await this.sendEmail(recipient.email, renderedTitle, renderedBody);
      }
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('SMTP not configured — skipping email');
      return;
    }

    const from = process.env.SMTP_FROM || 'Rockers HR <noreply@rockershr.com>';
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          html: body,
        });
        return;
      } catch (error) {
        this.logger.error(
          `Email send failed (attempt ${attempt}/${maxRetries}) to ${to}`,
          error,
        );
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * attempt * 1000));
        }
      }
    }
  }

  async getNotifications(
    userId: string,
    options: { is_read?: boolean; page: number; limit: number },
  ): Promise<{ data: Notification[]; total: number }> {
    const where: FindOptionsWhere<Notification> = { user_id: userId };
    if (options.is_read !== undefined) {
      where.is_read = options.is_read;
    }

    const [data, total] = await this.notificationRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });

    return { data, total };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationRepo.update(
      { id: notificationId, user_id: userId },
      { is_read: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update(
      { user_id: userId, is_read: false },
      { is_read: true },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { user_id: userId, is_read: false },
    });
  }
}
