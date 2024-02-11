const express = require('express');
const { generateSlug } = require('random-word-slugs');
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const Redis = require('ioredis');
const { Server } = require('socket.io');

const app = express();
const PORT = 9000;

const subscriber = new Redis(
  'redis://default:AVNS_iRkBVt3975YgEowOrJN@redis-34d4334-jyotindrakt21-e509.a.aivencloud.com:10488'
);

const io = new Server({ cors: '*' });

io.on('connection', (socket) => {
  socket.on('subscribe', (channel) => {
    socket.join(channel);
    socket.emit('message', `Joined ${channel}`);
  });
});

io.listen(9002, () => {
  console.log('Socket Server running on 9002');
});

const ecsClient = new ECSClient({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: 'AKIAZQ3DOHWS6MKP5G7Z',
    secretAccessKey: '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',
  },
});

const config = {
  CLUSTER: 'arn:aws:ecs:ap-south-1:654654193061:cluster/builder-cluster-1',
  TASK: 'arn:aws:ecs:ap-south-1:654654193061:task-definition/builder-task',
};

app.use(express.json());

app.post('/project', async (req, res) => {
  const { gitUrl } = req.body;
  const projectSlug = generateSlug();
  // Spin the container
  const command = new RunTaskCommand({
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: 'FARGATE',
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: 'ENABLED',
        subnets: [
          'subnet-03c039b633c0b8a41',
          'subnet-01b9ad8fc4387a4d9',
          'subnet-0277980f031930f35',
        ],
        securityGroups: ['sg-0aa700e1e69369391'],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: 'builder-image',
          environment: [
            { name: 'GIT_REPOSITORY__URL', value: gitUrl },
            { name: 'PROJECT_ID', value: projectSlug },
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);

  return res.json({
    status: 'queue',
    data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
  });
});

async function initRedisSubscribe() {
  subscriber.psubscribe('logs:*');
  subscriber.on('pmessage', (pattern, channel, message) => {
    io.to(channel).emit('message', message);
  });
  console.log('Subscribed to Logs......');
}

initRedisSubscribe();

app.listen(PORT, () => {
  console.log(`Api Server running.. on ${PORT}`);
});
