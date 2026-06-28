# 0024: Use object storage for image attachments

Production image attachments are stored in cloud object storage behind an internal `AttachmentStorageService` seam.
Local disk storage is allowed only for development.
This avoids coupling issue attachments to the app server filesystem and keeps the storage provider replaceable via the `ATTACHMENT_STORAGE_PROVIDER` env var.

The first production provider is Cloudinary (`ATTACHMENT_STORAGE_PROVIDER=cloudinary`), which stores assets as `authenticated` delivery type (private at the CDN) and signs URLs on read.
An S3-compatible provider is not yet implemented but the seam supports it.
