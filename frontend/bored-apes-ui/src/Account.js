// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

import { Box, Grid, Stack, Tooltip, Typography } from '@mui/material'
import React from 'react'
import Token from './Token'
import Blockies from 'react-18-blockies'

export default function Account({ data }) {
  const { id, tokens } = data
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack
        spacing={2}
        direction="row"
        sx={{ p: 2, backgroundColor: 'ghostwhite' }}
      >
        <Tooltip title={id}>
          <Box>
            <Blockies size={8} scale={3} seed={id} />
          </Box>
        </Tooltip>
        <Typography variant="h6">{id}</Typography>
      </Stack>

      <Grid container spacing={2}>
        {tokens.map(token => (
          <Token
            key={`${id}-${token.contract.name}-${token.token_id}`}
            data={token}
            owner={id}
          />
        ))}
      </Grid>
    </Stack>
  )
}
