# Bored Apes Yacht Club Owners – Example Frontend for the subgraph
This is a fairly simple [React](https://react.dev/) frontend for the the [boredApes subgraph](../../subgraph/README.md). It shows a simple website with the owners of [Bored Ape Yacht Club](https://boredapeyachtclub.com/) NFTs at the specified block. With the exception of the images themselves, the data is entirely sourced from the subgraph. 

## How to use
The frontend is a react app and can be run locally. You have to configure the API GW endpoint before you can run the frontend. 

### Configuration
The only parameter that you **have to configure** is the endpoint for the subgraph. It is available as output from `TheGraphServiceStack`. There are two ways to get that value:

1. Look it up on the AWS console with https://**REGION**.console.aws.amazon.com/cloudformation
2. Look it up on the console: You need to have the [AWS CLI](https://aws.amazon.com/cli/) installed as well as [JQ](https://jqlang.github.io/jq/) (which will be used to filter the console JSON output). Then you can run `aws cloudformation describe-stacks | jq -r '.Stacks[] | select(.StackName | contains("TheGraphServiceStack")) | .Outputs[] | select(.OutputKey | contains("apiGwEndpoint")) | .OutputValue'` It queries the cloudformation stacks and then filters based on the stack name. 

Take note of the value.

Copy `.env-template` to `.env` and set the `REACT_APP_API_GW_URL` to the value from the Cloudformation stack. 

### Run locally
Install it and run:

```sh
cd frontend/bored-apes-ui
npm install
npm start
```

This will run a webserver locally, the frontend will be available at http://localhost:3000.

## The idea behind the example

The frontend showcases the key abilities of subgraphs: 

1. Index specific blockchain smart contracts: The subgraphs indexes the BAYC NFT collection. 
2. Time-travel queries: Once a smart contract has been indexed, we can query the subgraph for any block in its past. The frontend has a slider to switch to a different block height. 
3. IPFS as data source: On the details view for each NFT you can see it traits. These traits are stored on the IPFS. The subgraph indexes the IPFS files as an additional data source and has access to all its data. It takes the traits and the image link from the IPFS files. 
4. Provenance chain: Because the subgraph is indexing the smart contract from its deployment block, we can see the full list of previous owners of a particular BAYC. 