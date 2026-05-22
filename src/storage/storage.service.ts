import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppConfig } from '../config/configuration';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string | undefined;

  constructor(private readonly config: ConfigService<AppConfig>) {
    const accountId = this.config.get('r2.accountId', { infer: true }) ?? '';
    this.bucket = this.config.get('r2.bucketName', { infer: true }) ?? 'lms-assets';
    this.publicUrl = this.config.get('r2.publicUrl', { infer: true });

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get('r2.accessKeyId', { infer: true }) ?? '',
        secretAccessKey: this.config.get('r2.secretAccessKey', { infer: true }) ?? '',
      },
    });
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    const safeKey = this.sanitizeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.log(`Uploaded: ${safeKey}`);
    return this.getPublicUrl(safeKey);
  }

  async delete(key: string): Promise<void> {
    const safeKey = this.sanitizeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey }));
    this.logger.log(`Deleted: ${safeKey}`);
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
    const safeKey = this.sanitizeKey(key);
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: safeKey, ContentType: contentType }),
      { expiresIn },
    );
  }

  async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const safeKey = this.sanitizeKey(key);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: safeKey }), {
      expiresIn,
    });
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl ?? ''}/${this.sanitizeKey(key)}`;
  }

  private sanitizeKey(key: string): string {
    return key
      .replace(/\.\./g, '')
      .replace(/^\/+/, '')
      .replace(/[^a-zA-Z0-9/_.-]/g, '_');
  }
}
