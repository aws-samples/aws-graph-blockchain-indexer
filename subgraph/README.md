# Deploying a Subgraph
The Graph node works with so-called _subgraphs_. They specifiy the smart contract(s) to index and the mapping that is used to store data in the DB. To define a subgraph, you need to define _GraphQL schema, subgraph configuration,_ and _mapping to DB_. Once you have a defined subgraph, it needs to be deployed to the graph node, so that it starts indexing. 

## Prerequisites
To manage subgraphs, you will need the Graph CLI. you can install it globally for easy access with:

```sh
npm install -g @graphprotocol/graph-cli
```

## Initializing a Subgraph
There are two ways to create a new subgraph:
1. You can start from scratch and have the Graph CLI scaffold a folder for you.
2. You can copy the folder `subgraph/boredApes` (or `subgraph/boredApes_simple`) and use that as a starting point.

### Scaffolding
With `graph init --allow-simple-name` you can scaffold a new folder for a subgraph. Run the command in the `subgraph` folder and answer all the questions. The second option is for the _Product for which to initialize_. Choose _hosted service_ here. We want to deploy the subgraph to our locally running node, so that is the correct option. 

Once the command has finished you will have a new folder with a basic template for a subgraph in it. `cd` into that folder.

### Using the Existing Subgraph
If you want to start of with an existing example, you can use the `subgraph/boredApes` (or `subgraph/boredApes_simple`). It is a subgraph that indexes all transfers of the popular [Bored Ape Yacht Club](https://boredapeyachtclub.com) NFT collection. Specifically, it tracks the BAYC NFTs. You can copy that folder into a new one and then start modifying it. The main difference between `boredApes` and `boredApes_simple` is the reliance on an archive node: `boredApes` call the smart contract during indexing and needs an archive node. `boredApes_simple` hardcodes some values and doesn't need to call the smart contract during indexing. It only relies on event data. That's why it only needs a full node. `cd` into the newly created folder.

## Defining a Subgraph
In the folder there are three main files of interest:
1. `schema.graphql`: The file holds the GraphQL schema that will be used for quering the subgraph. This file defines *what* data will be stored in the DB.
2. `subgraph.yaml`: The file holds the subgraph configuration. It defines the data source to index, their starting block and the events that should be indexed. 
3. `src/<subgraphname>.ts`: This file defines *how* data is mapped into the GraphQL schema. The files holds functions for each event that you are indexing. The functions define how the data is stored in the DB.

The three files define a subgraph. Because we are defining the mapping and the functions for the mapping ourselves (the _what_ and the _how)_, we have many liberties in creating complex subgraphs. Two things are worth mentioning: 
1. We are _not_ restricted to the data that we are receiving for each event. Instead, in the mapping functions, we can query different data sources to enrich our data set. We can also call other smart contracts to query additional data. 
2. We are _not_ restricted to events for triggering our functions. Instead we can define block handlers, which trigger potentially at every block. While possible, this it not advisable: Subgraphs that trigger on every block are slow and costly to compute. The [official graph documentation](https://thegraph.com/docs/en/) has a comprehensive guide on [creating a subgraph](https://thegraph.com/docs/en/developing/creating-a-subgraph).

## Deploying the Subgraph
After a subgraph has been defined, it needs to be deployed to the node. This consists of three steps: _building, creating,_ and _deploying._ The Graph CLI helps with that. 

### 1. Building the Subgraph
`graph codegen` builds the subgraph. This will create a `generated`` folder, which has all the files needed to deploy the subgraph. Whenever there is a modification to the subgraph it needs to be re-built.

### 2. Creating the Subgraph on the Node
The subgraph will be deployed to the graph node that is running already. As a prerequisite, we will query its IP address so that we can address it with our `graph` commands. You can either look up the IP on the AWS console with your EC2 instance or you can query it with the AWS CLI: 

```
export GRAPH_IP=$(aws ec2 describe-instances --filters 'Name=tag:Name,Values=TheGraphServiceStack/GraphCluster/nodeClientLaunchTemplate' --query  'Reservations[0].Instances[0].PublicIpAddress' --output text)
```

To simplify deployments it's also useful to define the subgraph's name as environment variable: 

```
export SUBGRAPH_NAME=mySubgraph
```

With both variables set, you can **create** your subgraph with: 

```
graph create --node http://${GRAPH_IP}:8020 ${SUBGRAPH_NAME}
```

This is a one time action.

### 3. Deploy the Subgraph to the Node
The subgraph needs to be deployed to the node with `graph deploy`. This is also the command to update the subgraph if there are any changes to it. The command is: 

```
graph deploy --node http://${GRAPH_IP}:8020/ --ipfs http://${GRAPH_IP}:5001 ${SUBGRAPH_NAME}
```

Once the command has finished, the graph has been deployed to the node and will start indexing. 

The three commands used for deploying the subgraph need to communicate to the graph node on port 8020 and 5001. The CDK allows access on these ports from the `allowed IP` and the `allowedSG`. That is why we set them initially in `cdk.json`.

# Querying a Subgraph
Once the subgraph has been deployed, it can be queried via GraphQL. From the development machine, you can query the EC2 directly. Contrary to the output of the `graph deploy` command, the GraphQL is reachable on port 80 (i.e. directly on the EC2 IP) and not on port 8080 (which is used on the docker container, running on EC2). From the dev machine, the GraphQL endpoint is `http://${GRAPH_IP}/subgraphs/name/${SUBGRAPH_NAME}`. For external access to the graph node use the API Gateway as described in [project's README.md](../README.md#Access-to-the-GraphQL-API).
