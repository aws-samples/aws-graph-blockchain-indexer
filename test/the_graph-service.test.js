// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

const cdk = require('aws-cdk-lib')
const { Template } = require('aws-cdk-lib/assertions')
const TheGraphService = require('../lib/the_graph-service-stack')

// example test. To run these tests, uncomment this file along with the
// example resource in lib/the_graph-service-stack.js
test('Graph Created', () => {
  const app = new cdk.App()
  // WHEN
  const stack = new TheGraphService.TheGraphServiceStack(app, 'MyTestStack')
  // THEN
  const template = Template.fromStack(stack)
  template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
    VisibilityTimeout: 300,
  })
})
