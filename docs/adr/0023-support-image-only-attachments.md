# 0023: Support image-only attachments

The v1 product supports image-only issue attachments, not general file attachments. Allowed formats are PNG, JPEG, and WebP; SVG and arbitrary documents are deferred. Images are stored outside the database, served through private or signed URLs, validated by the backend, and count against organization storage limits.
