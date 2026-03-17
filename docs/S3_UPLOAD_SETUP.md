# S3 setup for user video uploads (Remotion flow)

User videos are uploaded directly to S3 via **presigned URLs**. The app never receives the file bytes; the browser uploads to S3, and we use the resulting **read URL** in the Remotion Player and for server-side rendering.

## 1. Create an S3 bucket

1. In AWS Console → S3 → Create bucket.
2. Choose a name (e.g. `your-app-video-uploads`) and region (e.g. `us-east-1`).
3. Leave "Block all public access" **off** if you want public read URLs (simplest for Remotion). Otherwise you can use a bucket policy to allow public read only for the `uploads/` prefix.
4. Create the bucket.

## 2. Bucket CORS

In the bucket → **Permissions** → **Cross-origin resource sharing (CORS)**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

- `PUT`: browser uploads with the presigned URL.
- `GET`: optional; useful if you load the same URL in the same origin (e.g. Remotion Player).

For production, replace `"*"` in `AllowedOrigins` with your app origin(s), e.g. `["https://yourdomain.com"]`.

## 3. Bucket policy (public read for uploads)

If you want the **read URL** to work without signed requests (e.g. for Remotion Player and Lambda), allow public read on the uploads prefix.

In **Permissions** → **Bucket policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/uploads/*"
    }
  ]
}
```

Replace `YOUR_BUCKET_NAME` with your bucket name. This makes only objects under `uploads/` publicly readable.

## 4. IAM user for presigning

Create an IAM user (or use an existing one) that can generate presigned URLs and allow public write for uploads:

1. IAM → Users → Create user (e.g. `clipcap-upload`).
2. Attach a policy (inline or managed) like:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Presign",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/uploads/*"
    }
  ]
}
```

3. Create **Access key** for this user for use in the Next.js app.

## 5. Environment variables

In `.env.local` (or your deployment env):

```bash
# S3 uploads (presigned URL flow)
AWS_S3_UPLOAD_BUCKET=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

- **AWS_S3_UPLOAD_BUCKET**: bucket name.
- **AWS_REGION**: same region as the bucket.
- **AWS_ACCESS_KEY_ID** / **AWS_SECRET_ACCESS_KEY**: IAM user with the policy above.

On Vercel/Railway you can set these in the dashboard and omit the keys if you use an IAM role (when supported).

## 6. Usage in the app

- **API**: `POST /api/upload` with body `{ contentType, size }` returns `{ presignedUrl, readUrl }`.
- **Client**: use `uploadVideoToS3({ file, onProgress? })` from `@/lib/upload-video-s3`. It returns the **readUrl**; pass that as `videoUrl` in Remotion `inputProps` and to your project state.

## References

- [Remotion: Handling user video uploads](https://remotion.dev/docs/video-uploads)
- [Remotion: Presigned URLs](https://remotion.dev/docs/presigned-urls)
