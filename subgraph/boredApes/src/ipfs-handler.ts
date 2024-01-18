// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

import {
  log,
  json,
  Bytes,
  dataSource,
  JSONValueKind,
  ByteArray,
} from '@graphprotocol/graph-ts'

import { Attribute, TokenMetadata } from '../generated/schema'

export function handleTokenMetadata(content: Bytes): void {
  let tokenMetadata = new TokenMetadata(
    Bytes.fromByteArray(ByteArray.fromUTF8(dataSource.stringParam())),
  )

  const value = json.fromBytes(content).toObject()
  if (value) {
    const image = value.get('image')
    const attributesValue = value.get('attributes')

    let parsedAttributes = new Array<Bytes>()

    if (attributesValue && attributesValue.kind == JSONValueKind.ARRAY) {
      const attributesArray = attributesValue.toArray()
      for (let i = 0; i < attributesArray.length; i++) {
        const a = attributesArray[i]
        const attributeValue = a.toObject()
        const attributeTraitType = attributeValue.get('trait_type')
        const attributeTraitValue = attributeValue.get('value')

        if (attributeTraitType && attributeTraitValue) {
          const attributeId = content.concatI32(i)

          let attribute = Attribute.load(attributeId)
          if (!attribute) {
            attribute = new Attribute(attributeId)
            attribute.key = attributeTraitType.toString()
            attribute.value = attributeTraitValue.toString()
            attribute.save()
          }
          parsedAttributes.push(attributeId)
        } else {
          log.error('Error parsing attributes: {}', [content.toString()])
        }
      }
    }

    if (image && attributesValue) {
      tokenMetadata.image = image.toString()
      tokenMetadata.attributes = parsedAttributes
    }

    tokenMetadata.save()
    log.info('TokenMetadata for {} saved', [dataSource.stringParam()])
  }
}
