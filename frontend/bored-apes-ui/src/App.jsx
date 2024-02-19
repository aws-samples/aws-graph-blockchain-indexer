// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

import * as React from 'react'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

// import { useGetTopHolders } from './useRequest'
import Account from './Account.jsx'
import { LinearProgress, Slider, Stack, TextField } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'

import { useQuery } from 'react-query'
import { GraphQLClient, gql, request } from 'graphql-request'

const SUBGRAPH_URL = `${import.meta.env.VITE_APP_API_GW_URL}${import.meta.env.VITE_APP_SUBGRAPH_PATH}`
const STATUS_URL = `${import.meta.env.VITE_APP_API_GW_URL}${import.meta.env.VITE_APP_STATUS_PATH}`

const graphQLClient = new GraphQLClient(SUBGRAPH_URL, {
  headers: {
    authorization: import.meta.env.VITE_APP_API_KEY,
  },
})

export default function App() {
  const [blocknumber, setBlocknumber] = React.useState(12300000)
  const [blockDisplayNumber, setBlockDisplayNumber] = React.useState(12300000)

  const topHolderResult = useQuery(
    ['get-top-holders', blocknumber],
    async () => {
      console.log('Querying for blocknumber', blocknumber)
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
        { numberOfHolders: 100, blocknumber }
      )
      return accounts
    }
  )
  // const blockResults = useGetStartAndCurrentBlock("boredApes");)

  if (topHolderResult.isLoading) {
    return <span>Loading...</span>
  }

  if (topHolderResult.error) {
    return <span>Error: {topHolderResult.error.message}</span>
  }

  // if (blockResults.error) { console.log('Block error', blockResults.error) }

  const getProgress = () => {
    const head = parseInt(blockResults.data.chains[0].chainHeadBlock.number)
    const earliest = parseInt(blockResults.data.chains[0].earliestBlock.number)
    const latest = parseInt(blockResults.data.chains[0].latestBlock.number)
    return ((latest - earliest) / (head - earliest)) * 100
  }

  const handleSliderChange = (event, newValue) => {
    setBlockDisplayNumber(newValue)
  }

  return (
    <Container maxWidth="lg">
      <Grid2 container spacing={4}>
        <Grid2 xs={12}>
          <Typography variant="h4" component="h1" gutterBottom>
            {' '}
            Bored Ape Owners{' '}
          </Typography>
        </Grid2>

        <Grid2 xs={8}>
          <TextField
            variant="outlined"
            id="blocknumber"
            label="Block number"
            type="number"
            disabled
            value={blockDisplayNumber}
          />

          {/* <Typography id="input-slider" gutterBottom> Block Number </Typography> */}
          {/* <Slider value={blocknumber} min={parseInt(blockResults.data.chains[0].earliestBlock.number)} max={parseInt(blockResults.data.chains[0].latestBlock.number)} valueLabelDisplay='auto' aria-labelledby='input-slider' onChange={(event) => { */}
          <Slider
            value={blockDisplayNumber}
            min={12287507}
            max={17087390}
            valueLabelDisplay="auto"
            aria-labelledby="input-slider"
            onChange={handleSliderChange}
            onChangeCommitted={event => {
              setBlocknumber(blockDisplayNumber)
              console.log('New comitted blocknumber', blockDisplayNumber)
            }}
          />
        </Grid2>

        {/* <Grid2 xs={4}>
          <Typography variant='h5'>Indexing Status</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: '100%', mr: 1 }}>
              <LinearProgress variant="determinate" value={getProgress()} />
            </Box>
            <Box sx={{ minWidth: 35 }}>
              <Typography variant="body2" color="text.secondary">{`${Math.round(
                getProgress(),
              )}%`}</Typography>
            </Box>
          </Box>
        </Grid2> */}
      </Grid2>

      <Box sx={{ my: 4 }}>
        <Stack spacing={4}>
          {topHolderResult.isSuccess &&
            topHolderResult.data
              .filter(a => a.tokens.length > 0)
              .map(account => {
                return <Account key={account.id} data={account} />
              })}
        </Stack>
      </Box>
    </Container>
  )
}
