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
  ByteArray
} from '@graphprotocol/graph-ts'

import { Attribute, TokenMetadata } from '../generated/schema'

export function handleTokenMetadata(content: Bytes): void {
  log.info('Query metadata for {}', [dataSource.stringParam()])
  let tokenMetadata = new TokenMetadata(dataSource.stringParam())
  const value = json.fromBytes(content).toObject()
  if (value) {
    const image = value.get('image')
    const attributesValue = value.get('attributes')

    let parsedAttributes = new Array<string>()

    if (attributesValue && attributesValue.kind == JSONValueKind.ARRAY) {
      const attributesArray = attributesValue.toArray()
      for (let i = 0; i < attributesArray.length; i++) {
        const a = attributesArray[i]
        const attributeValue = a.toObject()
        const attributeTraitType = attributeValue.get('trait_type')
        const attributeTraitValue = attributeValue.get('value')

        if (attributeTraitType && attributeTraitValue) {
          const attributeId = `${dataSource.stringParam()}-${attributeTraitType.toString()}-${attributeTraitValue.toString()}`
          let attribute = Attribute.load(attributeId)
          if (!attribute) {
            attribute = new Attribute(attributeId)
            attribute.key = attributeTraitType.toString()
            attribute.value = attributeTraitValue.toString()
            attribute.save()
          }
          // const attribute = new Attribute(attributeTraitType.toString(), attributeTraitValue.toString())
          parsedAttributes.push(attributeId)
        }
      }
    }

    if (image && attributesValue) {
      tokenMetadata.image = image.toString()
      tokenMetadata.attributes = parsedAttributes
    }

    tokenMetadata.save()
  }
}
