const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadImage(fileBuffer, fileName, contentType) {
  const params = {
    Bucket: process.env.R2_BUCKET,
    Key: fileName,
    Body: fileBuffer,
    ContentType: contentType,
  };
  
  await s3.send(new PutObjectCommand(params));
  return `${process.env.R2_PUBLIC_URL}/${fileName}`;
}

module.exports = { s3, uploadImage };