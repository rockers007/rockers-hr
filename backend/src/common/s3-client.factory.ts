import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

/**
 * Build an S3Client from env vars. Returns null when credentials are
 * missing — every caller currently treats a null client as "file
 * storage not configured" and surfaces a 503.
 *
 * AWS_S3_ENDPOINT is optional. When set (e.g. for OCI Object Storage
 * S3-compat:
 *     https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
 * ) the client switches to path-style URLs (required by OCI) so the
 * bucket name appears in the path rather than as a subdomain.
 *
 * Leaving AWS_S3_ENDPOINT unset keeps the default AWS S3 behaviour
 * unchanged.
 */
export function buildS3Client(config: ConfigService): S3Client | null {
  const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
  const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
  const region = config.get<string>('AWS_REGION');
  if (!accessKeyId || !secretAccessKey || !region) return null;

  const endpoint = config.get<string>('AWS_S3_ENDPOINT');

  const opts: S3ClientConfig = {
    region,
    credentials: { accessKeyId, secretAccessKey },
  };
  if (endpoint && endpoint.trim().length > 0) {
    opts.endpoint = endpoint;
    // OCI Object Storage and most other S3-compat backends require
    // path-style addressing. AWS SDK v3 defaults to virtual-hosted-
    // style which only AWS supports.
    opts.forcePathStyle = true;
  }

  return new S3Client(opts);
}
