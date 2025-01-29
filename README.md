# Welcome to the TheGraph-Service CDK

This repo helps to spin up your own self-hosted [Graph node](https://thegraph.com) on AWS. It contains a CDK to deploy a node on ECS/EC2, an IPFS node, a managed PostgreSQL database, and an GraphQl API using ApiGateway. The main purpose of this service is to index and prepare the event data coming from the specified smart contracts, map them into a DB schema, store them in the PostgresqlDB in a more efficient form, and allow basic GraphQL queries through the API. The mappings and smart contract definitions are called *subgraph*.

The CDK has two stacks in it:
1. **BlockchainNodeStack:** provides an Ethereum full node based on [Amazon Managed Blockchain Access](https://aws.amazon.com/managed-blockchain/) (AMB). This node can act as a source for the Graph. If you want to use AMB as your blockchain node, deploy the BlockchainNodeStack. It outputs the node's endpoints. Take note of the _AccessorUrl_. This is what you need as endpoint for the graph stack.
2. **TheGraphServiceStack** provides the [Graph node](https://thegraph.com/). 

This repo has the normal folder structure for a CDK application. In addition, there are two subfolders worth mentioning:
1. `subgraph`: This folder contains the defintion for a subgraph that can be used for testing. Once theGraph is running, the subgraph needs to be deployed. Then the node will start indexing the subgraph. 
2. `frontend`: A simple react frontend that can be used to test the subgraph and display its results. It can be used to demonstrate the time-travel capabilities of the graph node. It works with the `boredApes` example subgraph.

# Network Support
TheGraph-Service has support for the following networks (chain IDs)

* Ethereum mainnet (1)
* Ethereum ropsten (3)
* Ethereum rinkeby (4)
* Ethereum goerli (5)
* Polygon mumbai (80001)
* Polygon matic (137)
* Sepolia (11155111)

# Architecture
The architecture of the graph node consists of a couple of AWS services. The diagram provides an overview:

![Graph Architecture](graphArchitecture.png)

There are some interesting points:

1. We will manage the graph node directly from the development machine. This includes deploying subgraphs as well as queries. 
2. The graph will store that data that it indexed from blockchain in an Aurora DB
3. The graph's metadata (subgraph definition and similar) are stored on IPFS, backed by an EFS volume.
4. The graph uses an Ethereum blockchain as data source. 
5. Queries to the graph can be made by calling an API Gateway, which is exposed to the public internet. (the other services are not accessible directly from the internet). 

# Prerequisites
Before you can deploy the CDK, you'll have to install all the needed npm packages of the TheGraph-Service CDK with:

```sh
$ npm install
```

Additionally, satisfy the following two pre-requisites. If you have them running already you can skip to section **Setup**. The requirements are
1. Install CDK
2. Install Docker
## Install CDK 
To manually install the `cdk` terminal client on MacOS or Linux and ensure the installed version:

```sh
$ npm install -g aws-cdk && cdk --version
```

## Install Docker
The CDK uses a docker based build process. The computer running the cdk commands needs to have [docker](https://www.docker.com/) installed to run the build. If you don't have docker installed, please install it before building the CDK stacks.

# Setup
Before deploying the CDK application, it's essential to define several key parameters, which are outlined in the following section.

## Configuration in .env and deployment
There are various configuration parameters that can be set in a `.env` file. The `.envTempate` file shows the config parameters with their default values. To set them copy the template to a `.env`:

```sh
cp .envTemplate .env
```

In `.env`, uncomment the values that you want to set and update them. The main ones that need to be set are:

* `CLIENT_URL` which specifies the RPC URL for the blockchain node. If you are using AMB as blockchain node, make sure that you are using the [token based access](https://docs.aws.amazon.com/managed-blockchain/latest/ethereum-dev/ethereum-tokens.html), because the Graph won't sigv4 its requests by default. The `BlockchainNodeStack` provides this URL in its output. 
* `CHAIN_ID` specifies the blockchain that you're indexing. It defaults to *1*, which is the Ethereum mainnet. 
* `API_KEY` is the API key that you need to provide to query your graph node. It defaults to *secretToken*. 

We need to allow external access to the graph node just for the deployment of the subgraphs later on. There are two ways of deploying subgraphs to the graph node. 

1. From your **local development machine**: To access the graph node from the local machine, we will to open the graph node  to the *external* IP address of the development machine. You can query the external IP with [whatsmyip.org](https://www.whatsmyip.org/). Take note of the external IP and set it in `.env` as `ALLOWED_IP`.
2. From an **AWS-based instance** (such as Cloud9): To permit traffic from another EC2 instance, you need to open the graph's security group to allow traffic from the security group that has the cloud9 instance. You can take note of the security group's ID (it should start with `sg-`) and set it in `.env` as `ALLOWED_SG`.

## Deployment 
At this point you can list the available cdk stacks of our CDK with

```sh
$ cdk list
```

If you haven't utilized the CDK before for this account and region, you need to bootstrap the AWS account with the `CDK Toolkit` by running this command. 

```sh
$ cdk bootstrap aws://<YOUR-AWS-ACCOUNT-NUMBER>/<REGION>
```
You can now deploy the whole stack with the following command

```sh
$ cdk deploy TheGraphServiceStack
```

# Deploy a Subgraph
Once the node is up and running, you will need to deploy a subgraph to it, so that the node has something to index. Refer to the steps in the [README](subgraph/README.md) in the `/subgraph` folder!

# Access the GraphQL API
There are two ways of accessing the Graph node: 
1. directly from a specified IP (usually the development machine): If an IP has been exposed to the CDK as `allowedIP`, the security groups allow direct access to the EC2 instance that is running the graph containers. This is for development purposes.
2. through API Gateway: external access for querying the graph is exposed via API GW. There are two routes on the API GW: 
   1. `POST <base-url>/subgraphs/name/{subgraphName}`: This route accepts valid subgraphnames as path element. It is used for queries on the specific subgraph.
   2. `POST <base-url>/graphql`: This route is for status queries about the syncing status of the graph node. 

The route through the API gateway needs to be authorized. For that the CDK includes a simple authorizer that checks for the existence of an API key in the `authorization` header. The value can be set in `cdk.json` (see above). The authorisation header is only necessary for the queries through the API gateway, because API gateway can be accessed from anywhere. 

You can always lookup the API's **base-url** of the TheGraph-Service on the AWS ParameterStore. It is stored at `/indexer/queryEndpoint` and should look like  `https://<API ID>.execute-api.<region>.amazonaws.com`.

Remark: If you access the URL using the browser, you will simply get a "message: Not found" response. The API accepts only POST requests.

# GraphQL API Schema
You can lookup and review the GraphQL Schema in [schema.graphql](subgraph/boredApes/schema.graphql).

# Tear-down of TheGraph-Service
The CDK is configured to completely destroy the resources. This is useful for development environments that requrie rapid re-deployments of the resources to test out various features. However, it also means that after destroying a stack, no data is retained. If you want to retain the database with with the indexed data, you can configure that in the CDK by modifying the `removalPolicy` of the various components. In particular, the database can be set to `RemovalPolicy.SNAPSHOT` to create a DB snapshot before the DB is deleted. 

The command to delete the stack is:

```sh
$ cdk destroy TheGraphServiceStack
```

Similarly, if you've used the BlockchainNodeStack for the creating an AMB node, it can be taken down with: 

```sh
$ cdk destroy BlockchainNodeStack
```
