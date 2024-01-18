// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { teal } from '@mui/material/colors'
import React from 'react'
import Blockies from 'react-18-blockies'

export default function Token({ data, owner }) {
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  const { token_id, contract, uri, metadata, previous_owners } = data

  let imgUrl =
    'https://www.grouphealth.ca/wp-content/uploads/2018/05/placeholder-image.png'
  if (metadata != null) {
    imgUrl = `https://ipfs.io/ipfs/${metadata.image.slice(7)}`
  }

  let attributes = []
  if (metadata != null) {
    attributes = metadata.attributes
    // setAttributesString(attributes.map(a => `${a.key}: ${a.value}`).join(`','`))
  }

  const handleClose = () => {
    setDetailsOpen(false)
  }

  const handleOpen = () => {
    setDetailsOpen(true)
  }

  return (
    <React.Fragment>
      <Grid item>
        <Card sx={{ width: 200 }}>
          <CardActionArea onClick={handleOpen}>
            <CardMedia
              sx={{ height: 150 }}
              image={imgUrl}
              title={`BAYC#${token_id}`}
            />
            <CardContent>
              <Typography gutterBottom variant="h6" component="div">
                {contract.symbol}#{token_id}
              </Typography>

              {/* Do not display previous owners on card directly. */}
              {/* <Typography gutterBottom variant="caption" component="div">
                Previous Owners
              </Typography>

              <Grid container>
                {previous_owners.map(o => (
                  <Grid item xs={3} sx={{ mt: 1.5 }}>
                    <Tooltip
                      key={`prevOwner-${token_id}-${o.account.id}`}
                      title={o.account.id}
                    >
                      <Box>
                        <Blockies
                          key={`prevOwner-${token_id}-${o.account.id}`}
                          size={8}
                          scale={3}
                          seed={o.account.id}
                        />
                      </Box>
                    </Tooltip>
                  </Grid>
                ))}
              </Grid> */}
            </CardContent>
          </CardActionArea>
        </Card>
      </Grid>
      <Dialog open={detailsOpen} onClose={handleClose}>
        <DialogTitle>
          {contract.symbol}#{token_id}
        </DialogTitle>
        <DialogContent>
          {/* <Stack direction="row"> */}

          <Stack>
            <Box
              component="img"
              alt={`${contract.symbol}#${token_id}`}
              src={imgUrl}
            />

            <Typography variant="h6" sx={{ mt: 2 }}>
              Owner
            </Typography>
            <Stack spacing={2} direction="row" sx={{ p: 2 }}>
              <Tooltip title={owner}>
                <Box>
                  <Blockies size={8} scale={3} seed={owner} />
                </Box>
              </Tooltip>
              <Typography variant="body">{owner}</Typography>
            </Stack>

            {previous_owners.length != 0 && (
              <Typography variant="h6" sx={{ mt: 2 }}>
                Previous Owners
              </Typography>
            )}

            <Grid container>
              {previous_owners.map(o => (
                <Grid
                  item
                  xs={1}
                  sx={{ mt: 1.5, pl: 2 }}
                  key={`prevOwner-${token_id}-${o.account.id}`}
                >
                  <Tooltip title={o.account.id}>
                    <Box>
                      <Blockies size={8} scale={3} seed={o.account.id} />
                    </Box>
                  </Tooltip>
                </Grid>
              ))}
            </Grid>

            <Typography variant="h6" sx={{ mt: 2 }}>
              Attributes
            </Typography>
            {attributes.map(a => (
              <Typography sx={{ pl: 2 }}>
                <Typography
                  component="span"
                  sx={{ color: 'teal', fontWeight: 'bold' }}
                >
                  {a.key}:
                </Typography>{' '}
                {a.value}
              </Typography>
            ))}
          </Stack>
          {/* </Stack> */}
        </DialogContent>
      </Dialog>
    </React.Fragment>
  )
}
