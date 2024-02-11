const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const { S3, S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Redis } = require('ioredis');

const s3Client = new S3Client({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: 'AKIAZQ3DOHWS6MKP5G7Z',
    secretAccessKey: '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',
  },
});

const publisher = new Redis(
  'redis://default:AVNS_iRkBVt3975YgEowOrJN@redis-34d4334-jyotindrakt21-e509.a.aivencloud.com:10488'
);

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log) {
  publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

async function init() {
  console.log('Executing script.js');
  publishLog('Build started');
  const outDirPath = path.join(__dirname, 'output');

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on('data', function (data) {
    console.log(data.toString());
    publishLog(data.toString());
  });

  p.stdout.on('error', function (data) {
    console.log('Error', data.toString());
    publishLog(`error: ${data.toString()}`);
  });

  p.stdout.on('close', async function () {
    console.log('Build Complete');
    publishLog('Build Complete');
    const distFolderPath = path.join(__dirname, 'output', 'dist');
    const distFolderContents = fs.readdirSync(distFolderPath, {
      recursive: true, //All nested folders will be shown
    });

    for (const file of distFolderContents) {
      const filePath = path.join(distFolderPath, file);
      if (fs.lstatSync(filePath).isDirectory()) continue;
      console.log('Uploading FilePath 🟡');
      publishLog(`uploading ${filePath}`);
      const command = new PutObjectCommand({
        Bucket: 'vercel-projects-bucket',
        Key: `__outputs/${PROJECT_ID}/${file}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });

      await s3Client.send(command);
      console.log('Uploaded File Path✅');
      publishLog(`uploaded ${file}`);
    }
    console.log('Files added to s3');
    publishLog('Files added !!! DONE......');
  });
}

init();
