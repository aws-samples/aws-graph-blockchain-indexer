// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from 'matchstick-as/assembly/index'
import { Address, BigInt } from '@graphprotocol/graph-ts'
import { Approval } from '../generated/schema'
import { Approval as ApprovalEvent } from '../generated/BoredApeYachtClub/BoredApeYachtClub'
import { handleApproval } from '../src/bored-ape-yacht-club'
import { createApprovalEvent } from './bored-ape-yacht-club-utils'

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe('Describe entity assertions', () => {
  beforeAll(() => {
    let owner = Address.fromString('0x0000000000000000000000000000000000000001')
    let approved = Address.fromString(
      '0x0000000000000000000000000000000000000001'
    )
    let tokenId = BigInt.fromI32(234)
    let newApprovalEvent = createApprovalEvent(owner, approved, tokenId)
    handleApproval(newApprovalEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test('Approval created and stored', () => {
    assert.entityCount('Approval', 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      'Approval',
      '0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1',
      'owner',
      '0x0000000000000000000000000000000000000001'
    )
    assert.fieldEquals(
      'Approval',
      '0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1',
      'approved',
      '0x0000000000000000000000000000000000000001'
    )
    assert.fieldEquals(
      'Approval',
      '0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1',
      'tokenId',
      '234'
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
