import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBExtendedOperation } from './DynamoDBExtendedOperation'

const db: DynamoDBExtendedOperation = new DynamoDBExtendedOperation(
    new DynamoDBClient({ region: process.env.AWS_REGION! })
)
export default db
