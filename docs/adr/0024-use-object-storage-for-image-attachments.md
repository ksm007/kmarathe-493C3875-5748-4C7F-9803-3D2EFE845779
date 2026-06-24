# 0024: Use object storage for image attachments

Production image attachments are stored in S3-compatible object storage behind an internal attachment storage service. Local disk storage is allowed only for development. This avoids coupling issue attachments to the app server filesystem and keeps the storage provider replaceable.
