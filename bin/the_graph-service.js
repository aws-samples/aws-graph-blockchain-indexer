#!/usr/bin/env node

const cdk = require('aws-cdk-lib')
const { BlockchainNodeStack } = require('../lib/blockchain-node-stack')
const { TheGraphServiceStack } = require('../lib/the_graph-service-stack')
const { AwsSolutionsChecks } = require('cdk-nag')

const app = new cdk.App()

const clientUrl = app.node.tryGetContext('clientUrl')
const chainId = app.node.tryGetContext('chainId') || 1
const allowedIP = app.node.tryGetContext('allowedIP')
const allowedSG = app.node.tryGetContext('allowedSG')
const blockchainInstanceType =
  app.node.tryGetContext('blockchainInstanceType') || 'bc.m5.xlarge'
const graphInstanceType =
  app.node.tryGetContext('graphInstanceType') || 't3a.xlarge'

const logLevel = app.node.tryGetContext('logLevel') || 'info'

const apiKey = app.node.tryGetContext('apiKey') || 'secretApiKey'

const blockchainNodeStack = new BlockchainNodeStack(
  app,
  'BlockchainNodeStack',
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    blockchainInstanceType,
    chainId,
  }
)

const graphStack = new TheGraphServiceStack(app, 'TheGraphServiceStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  logLevel,
  clientUrl,
  chainId,
  graphInstanceType,
  allowedIP,
  allowedSG,
  apiKey,
})

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))
