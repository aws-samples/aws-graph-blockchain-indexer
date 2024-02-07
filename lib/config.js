const path = require('path')
const dotenv = require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
})

// 1. Configure dotenv to read from our `.env` file
// dotenv.config({ path: path.resolve(__dirname, '../.env') })

// 2. Define a function to retrieve our env variables
function getConfig() {
  const config = {
    clientUrl: process.env.CLIENT_URL || 'http://localhost:8545',
    allowedIP: process.env.ALLOWED_IP || '',
    allowedSG: process.env.ALLOWED_SG || '',
    logLevel: process.env.LOG_LEVEL || 'info',
    chainId: Number(process.env.CHAIN_ID || '1'),
    apiKey: process.env.API_KEY || 'secretToken',
    graphInstanceType: process.env.GRAPH_INSTANCE_TYPE || 't3a.xlarge',
    blockchainInstanceType:
      process.env.BLOCKCHAIN_INSTANCE_TYPE || 'bc.m5.xlarge',
    awsAccount: process.env.AWS_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    awsRegion:
      process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1',
  }
  return config
}

exports.getConfig = getConfig
