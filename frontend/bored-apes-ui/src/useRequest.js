// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

import { useQuery } from 'react-query'
import { GraphQLClient, gql } from 'graphql-request'

const SUBGRAPH_URL = `${process.env.REACT_APP_API_GW_URL}${process.env.REACT_APP_SUBGRAPH_PATH}`
const STATUS_URL = `${process.env.REACT_APP_API_GW_URL}${process.env.REACT_APP_STATUS_PATH}`

const graphQLClient = new GraphQLClient(SUBGRAPH_URL, {
  headers: {
    authorization: process.env.REACT_APP_API_KEY,
  },
})
const graphQLClientStatus = new GraphQLClient(STATUS_URL, {
  headers: {
    authorization: process.env.REACT_APP_API_KEY,
  },
})

export function useGetTopHolders(numberOfHolders, blocknumber) {
  return useQuery(['get-top-holders', blocknumber], async () => {
    const { accounts } = await graphQLClient.request(
      gql`
        query getTopHolders($numberOfHolders: Int!, $blocknumber: Int!) {
          accounts(first: $numberOfHolders, block: { number: $blocknumber }) {
            id
            tokens {
              contract {
                name
                symbol
              }
              token_id
              uri
              metadata {
                image
                attributes {
                  key
                  value
                }
              }
              previous_owners {
                account {
                  id
                }
              }
            }
          }
        }
      `,
      { numberOfHolders, blocknumber }
    )
    return accounts
  })
}

export function useGetStartAndCurrentBlock(subgraphName) {
  return useQuery(['get-start-and-current-block'], async () => {
    const { indexingStatusForCurrentVersion } =
      await graphQLClientStatus.request(
        gql`
          query useGetStartAndCurrentBlock($subgraphName: String!) {
            indexingStatusForCurrentVersion(subgraphName: $subgraphName) {
              chains {
                chainHeadBlock {
                  number
                }
                earliestBlock {
                  number
                }
                latestBlock {
                  number
                }
                lastHealthyBlock {
                  number
                }
              }
            }
          }
        `,
        { subgraphName }
      )
    return indexingStatusForCurrentVersion
  })
}
