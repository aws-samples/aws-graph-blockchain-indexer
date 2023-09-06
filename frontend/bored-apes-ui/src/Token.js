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
import React from 'react'
import Blockies from 'react-18-blockies'

export default function Token({ data, owner }) {
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  const { tokenId, contract, uri, ipfsUri, previousOwners } = data

  let imgUrl =
    'https://www.grouphealth.ca/wp-content/uploads/2018/05/placeholder-image.png'
  if (ipfsUri != null) {
    imgUrl = `https://ipfs.io/ipfs/${ipfsUri.image.slice(7)}`
  }

  let attributes = []
  if (ipfsUri != null) {
    attributes = ipfsUri.attributes
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
              title={`BAYC#${tokenId}`}
            />
            <CardContent>
              <Typography gutterBottom variant="h6" component="div">
                {contract.symbol}#{tokenId}
              </Typography>
              {/* <Typography gutterBottom variant="caption" component="div">Previous Owners</Typography> */}

              {/* <Grid container>
                {previousOwners.map((o) =>
                  <Grid item xs={3} sx={{ mt: 1.5 }}>
                    <Tooltip key={`prevOwner-${tokenId}-${o.account.id}`} title={o.account.id}>
                      <Box>
                        <Blockies key={`prevOwner-${tokenId}-${o.account.id}`} size={8} scale={3} seed={o.account.id} />
                      </Box>
                    </Tooltip>
                  </Grid>
                )}

              </Grid> */}
            </CardContent>
          </CardActionArea>
        </Card>
      </Grid>
      <Dialog open={detailsOpen} onClose={handleClose}>
        <DialogTitle>
          {contract.symbol}#{tokenId}
        </DialogTitle>
        <DialogContent>
          {/* <Stack direction="row"> */}

          <Stack>
            <Box
              component="img"
              alt={`${contract.symbol}#${tokenId}`}
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

            <Typography variant="h6" sx={{ mt: 2 }}>
              Attributes
            </Typography>
            {attributes.map(a => `${a.key}: ${a.value}`).join(', ')}

            {previousOwners.length != 0 && (
              <Typography variant="h6" sx={{ mt: 2 }}>
                Previous Owners
              </Typography>
            )}

            <Grid container>
              {previousOwners.map(o => (
                <Grid
                  item
                  xs={1}
                  sx={{ mt: 1.5 }}
                  key={`prevOwner-${tokenId}-${o.account.id}`}
                >
                  <Tooltip title={o.account.id}>
                    <Box>
                      <Blockies size={8} scale={3} seed={o.account.id} />
                    </Box>
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
          </Stack>
          {/* </Stack> */}
        </DialogContent>
      </Dialog>
    </React.Fragment>
  )
}
