// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.

// This AWS Content is provided subject to the terms of the AWS Customer Agreement
// available at http://aws.amazon.com/agreement or other written agreement between
// Customer and either Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager')
const { Client } = require('pg')

const secretsManager = new SecretsManagerClient()

exports.handler = async (event, context) => {
  // Retrieve the secret ARN from the environment variable
  // const secretArn = process.env.DB_SECRET_ARN
  // const dbName = process.env.DB_NAME

  const secretArn = event.ResourceProperties.secretArn
  const dbName = event.ResourceProperties.dbName

  console.log(`Parameters: { secretArn: ${secretArn}, dbName: ${dbName} }`)

  const response = {}

  try {
    switch (event.RequestType) {
      case 'Create':
        // Retrieve the secret value from Secrets Manager
        const response = await secretsManager.send(
          new GetSecretValueCommand({
            SecretId: secretArn,
          })
        )

        // Parse the secret value as JSON
        const secretValue = JSON.parse(response.SecretString)

        // connect to DB cluster
        const dbClient = new Client({
          host: secretValue.host,
          port: secretValue.port,
          user: secretValue.username,
          password: secretValue.password,
          database: 'postgres',
        })

        // Connect to the PostgreSQL database
        await dbClient.connect()

        // Create a new database
        await dbClient.query(
          `CREATE DATABASE ${dbName} ENCODING = 'UTF8' LC_COLLATE = 'C' LC_CTYPE = 'C' TEMPLATE template0`
        )

        // Disconnect from the PostgreSQL database
        await dbClient.end()

        // Return a success message as the function's output
        return 'Database created successfully'

      default:
        return {}
    }
  } catch (error) {
    console.error(error)

    // Return an error message as the function's output
    throw new Error(error.message)
  }
}
