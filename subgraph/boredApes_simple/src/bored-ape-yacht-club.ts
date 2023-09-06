// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

import {
  log,
  json,
  Bytes,
  dataSource,
  ethereum,
  BigInt,
  Address
} from '@graphprotocol/graph-ts'
import {
  Approval as ApprovalEvent,
  ApprovalForAll as ApprovalForAllEvent,
  BoredApeYachtClub,
  OwnershipTransferred as OwnershipTransferredEvent,
  Transfer as TransferEvent
} from '../generated/BoredApeYachtClub/BoredApeYachtClub'
import {
  Approval,
  ApprovalForAll,
  OwnershipTransferred,
  Transfer,
  Account,
  Token,
  Contract,
  PrevTokenAccount
} from '../generated/schema'

import { TokenMetadata as TokenMetadataTemplate } from '../generated/templates'

export function handleApproval(event: ApprovalEvent): void {
  let entity = new Approval(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.owner = event.params.owner
  entity.approved = event.params.approved
  entity.tokenId = event.params.tokenId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleApprovalForAll(event: ApprovalForAllEvent): void {
  let entity = new ApprovalForAll(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.owner = event.params.owner
  entity.operator = event.params.operator
  entity.approved = event.params.approved

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

function getContract(address: Bytes): Contract {
  let contract = Contract.load(address)

  if (!contract) {
    contract = new Contract(address)
    contract = new Contract(address)
    // const onChainContract = BoredApeYachtClub.bind(Address.fromBytes(address))

    contract.name = 'Bored Ape Yacht Club'
    contract.symbol = 'BAYC'

    contract.save()
    log.info("Detected new contract '{}' at {} with Symbol {}", [
      contract.name,
      contract.id.toHex(),
      contract.symbol
    ])
  }

  return contract
}

function getAccount(address: Bytes): Account {
  let account = Account.load(address)

  if (!account) {
    account = new Account(address)
    account.save()
    log.info('Detected new account {}', [account.id.toHex()])
  }
  return account
}

function getToken(
  contract: Contract,
  owner: Account,
  tokenId: BigInt,
  timestamp: BigInt
): Token {
  const id = contract.id.concatI32(tokenId.toI32())
  let token = Token.load(id)

  if (!token) {
    token = new Token(id)
    token.tokenId = tokenId
    token.contract = contract.id
    token.owner = owner.id
    token.updatedAtTimestamp = timestamp
    token.uri = `ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/${token.tokenId}`

    // index metadata with its own handler
    const ipfsHash = `${token.uri.substring(7)}`
    log.info('Adding ipfsHash {}', [ipfsHash])
    token.ipfsUri = ipfsHash
    TokenMetadataTemplate.create(ipfsHash)
    token.save()

    log.info('Found new token {}/{}', [
      contract.symbol,
      token.tokenId.toString()
    ])
  }

  return token
}

export function handleTransfer(event: TransferEvent): void {
  let entity = new Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.from = event.params.from
  entity.to = event.params.to
  entity.tokenId = event.params.tokenId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // entities
  let contract = getContract(event.address)
  let owner = getAccount(event.params.to)
  let token = getToken(
    contract,
    owner,
    event.params.tokenId,
    event.block.timestamp
  )

  // add previous owners for non-mint transfers
  if (
    event.params.from !=
    Address.fromString('0x0000000000000000000000000000000000000000')
  ) {
    const prevOwnerId = token.owner.concat(token.id)
    let prevOwner = new PrevTokenAccount(prevOwnerId)
    prevOwner.account = token.owner
    prevOwner.token = token.id
    prevOwner.save()
    log.info('New previous owner {} for token {}', [
      prevOwner.account.toHexString(),
      token.tokenId.toString()
    ])
  }

  token.owner = owner.id
  token.updatedAtTimestamp = event.block.timestamp
  token.save()
}
