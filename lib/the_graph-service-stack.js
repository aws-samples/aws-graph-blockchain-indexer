// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

const { Stack, CfnOutput, Duration } = require('aws-cdk-lib')
const { NagSuppressions } = require('cdk-nag')
const path = require('path')

const {
  HttpApi,
  VpcLink,
  HttpMethod,
  CorsHttpMethod,
} = require('aws-cdk-lib/aws-apigatewayv2')
const { TheGraphCluster } = require('./theGraphCluster-construct')
const { Vpc } = require('aws-cdk-lib/aws-ec2')

const {
  HttpLambdaAuthorizer,
  HttpLambdaResponseType,
} = require('aws-cdk-lib/aws-apigatewayv2-authorizers')
const { StringParameter } = require('aws-cdk-lib/aws-ssm')
const { LogGroup } = require('aws-cdk-lib/aws-logs')
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs')
const { Runtime } = require('aws-cdk-lib/aws-lambda')
const {
  HttpAlbIntegration,
} = require('aws-cdk-lib/aws-apigatewayv2-integrations')

class TheGraphServiceStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props)

    const {
      clientUrl,
      chainId,
      graphInstanceType,
      dbInstanceType,
      allowedIP,
      allowedSG,
    } = props

    // Create the graph cluster
    const graphCluster = new TheGraphCluster(this, 'GraphCluster', {
      clientUrl,
      chainId,
      graphInstanceType,
      dbInstanceType,
      allowedIP,
      allowedSG,
    })
    HttpAlbIntegration
    const vpc = Vpc.fromLookup(this, 'Vpc', { isDefault: true })

    const vpcLink = new VpcLink(this, 'VpcLink', {
      vpc,
      subnets: {
        availabilityZones: [
          Stack.of(this).availabilityZones[0],
          Stack.of(this).availabilityZones[1],
        ],
      },
      securityGroups: [graphCluster.albSecurityGroup],
      description: 'VpcLink for the TheGraph service',
    })

    // create lambda function for API Key authorization
    const authorizerLambda = new NodejsFunction(
      this,
      'TheGraphAuthorizerLambda',
      {
        entry: path.join(__dirname, '../src/lambdas', 'apiKeyAuthorizer.js'),
        handler: 'handler',
        runtime: Runtime.NODEJS_22_X,
        environment: {
          API_TOKEN: props.apiKey,
        },
      }
    )

    // lambda authorizer for httpAPI
    const authorizer = new HttpLambdaAuthorizer(
      'TheGraphAuthorizer',
      authorizerLambda,
      {
        responseTypes: [HttpLambdaResponseType.SIMPLE],
      }
    )

    const httpAPI = new HttpApi(this, 'TheGraphAPI', {
      defaultAuthorizer: authorizer,
      corsPreflight: {
        allowHeaders: ['authorization', 'content-type'],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.HEAD,
          CorsHttpMethod.OPTIONS,
          CorsHttpMethod.POST,
        ],
        allowOrigins: ['*'],
        maxAge: Duration.days(10),
      },
    })

    const httpApiLogGroup = new LogGroup(this, 'HttpApiAccessLogs', {
      retention: 7,
    })

    const defaultStage = httpAPI.defaultStage.node.defaultChild
    defaultStage.accessLogSettings = {
      destinationArn: httpApiLogGroup.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        userAgent: '$context.identity.userAgent',
        sourceIp: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        httpMethod: '$context.httpMethod',
        path: '$context.path',
        status: '$context.status',
        responseLength: '$context.responseLength',
      }),
    }

    const p80Integration = new HttpAlbIntegration(
      'p80Integration',
      graphCluster.albListenerPort80,
      {
        vpcLink: vpcLink,
        method: HttpMethod.POST,
      }
    )

    const p8030Integration = new HttpAlbIntegration(
      'p8030Integration',
      graphCluster.albListenerPort8030,
      {
        vpcLink: vpcLink,
        method: HttpMethod.POST,
      }
    )

    httpAPI.addRoutes({
      path: '/graphql',
      methods: [HttpMethod.POST],
      integration: p8030Integration,
    })

    httpAPI.addRoutes({
      path: '/subgraphs/name/{subgraphName}',
      methods: [HttpMethod.POST],
      integration: p80Integration,
    })

    new CfnOutput(this, 'apiGwEndpoint', { value: httpAPI.apiEndpoint })

    new StringParameter(this, 'apiGwEndpointParameter', {
      parameterName: '/indexer/queryEndpoint',
      description: 'Endpoint for querying the indexer',
      stringValue: httpAPI.apiEndpoint,
    })

    // Nag Suppressions
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      '/TheGraphServiceStack/TheGraphAuthorizerLambda/ServiceRole/Resource',
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'roles created with minimal permissions by CDK',
        },
      ]
    )
  }
}

module.exports = { TheGraphServiceStack }
