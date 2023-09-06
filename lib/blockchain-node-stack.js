// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

const { Stack, Duration, CfnOutput } = require('aws-cdk-lib')
const { CfnNode, CfnAccessor } = require('aws-cdk-lib/aws-managedblockchain')

class BlockchainNodeStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props)

    const networkNames = new Map([
      [1, 'n-ethereum-mainnet'],
      [5, 'n-ethereum-goerli'],
      [4, 'n-ethereum-rinkeby'],
    ])

    const networkName = networkNames.get(props.chainId)

    // Create Blockchain node with AMB
    const blockchainNode = new CfnNode(this, 'BlockchainNode', {
      networkId: networkName,
      nodeConfiguration: {
        availabilityZone: Stack.of(this).availabilityZones[0],
        instanceType: props.blockchainInstanceType,
      },
    })

    // Create Accessor
    const accessor = new CfnAccessor(this, 'Accessor', {
      accessorType: 'BILLING_TOKEN',
    })

    new CfnOutput(this, 'BlockchainNodeUrl', {
      value: `https://${blockchainNode.attrNodeId}.ethereum.managedblockchain.${
        Stack.of(this).region
      }.amazonaws.com`,
    })

    new CfnOutput(this, 'AccessorUrl', {
      value: `https://${
        blockchainNode.attrNodeId
      }.t.ethereum.managedblockchain.${
        Stack.of(this).region
      }.amazonaws.com?billingtoken=${accessor.attrBillingToken}`,
    })

    this.clientUrl = `https://${
      blockchainNode.attrNodeId
    }.t.ethereum.managedblockchain.${
      Stack.of(this).region
    }.amazonaws.com?billingtoken=${accessor.attrBillingToken}`
  }
}

module.exports = { BlockchainNodeStack }
