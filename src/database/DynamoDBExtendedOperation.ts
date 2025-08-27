import {
    DeleteCommand,
    DeleteCommandOutput,
    DynamoDBDocumentClient,
    PutCommand,
    PutCommandOutput,
    QueryCommandOutput,
    UpdateCommand,
    UpdateCommandOutput,
    QueryCommand,
    ScanCommand,
    ScanCommandOutput,
} from '@aws-sdk/lib-dynamodb'
import {
    DescribeTableCommand,
    DynamoDBClient,
    DynamoDBClientConfig,
    TransactWriteItemsCommand,
    TransactWriteItemsCommandOutput,
} from '@aws-sdk/client-dynamodb'
import {
    IDynamoDBExtendedOperation,
    Persistence,
} from './IDynamoDBExtendedOperation'
import { DynamoDBExtendedError } from './DynamoDBExtendedError'
import {
    EXPRESSION_JOIN,
    ExpressionAttributeNamesMaker,
    ExpressionAttributeValuesMaker,
    FilterExpressionAttributeValuesMaker,
    FilterExpressionMaker,
    ExpressionMaker,
    KeyAttributeMaker,
    DynamoDBJSONConverter,
    UpdateExpressionMaker,
} from './utils'
import { marshall, NativeAttributeValue } from '@aws-sdk/util-dynamodb'
import { ReturnValue } from '@aws-sdk/client-dynamodb'
import { Filters } from './types'

const INVALID_TABLE = 'Invalid table name: table name must not be empty'

export class DynamoDBExtendedOperation implements IDynamoDBExtendedOperation {
    constructor(public client: DynamoDBDocumentClient) {}

    public static from(config: DynamoDBClientConfig) {
        const instance: DynamoDBClient = new DynamoDBClient(config)
        const client = DynamoDBDocumentClient.from(instance)
        return new DynamoDBExtendedOperation(client)
    }

    //prettier-ignore
    async update<T extends Persistence>(
    table: string,
    keys: Partial<T>,
    data: Partial<T>,
    condition?: Partial<T>,
    returnValues?: ReturnValue,
  ): Promise<UpdateCommandOutput> {
    try {
      // Hash and Range keys from the specified table.
      const tableKeys = await this.getTableKeys(table);
      const command = new UpdateCommand({
        TableName: table,
        UpdateExpression: UpdateExpressionMaker(data, tableKeys), //excluding keys from update expression
        ExpressionAttributeValues: ExpressionAttributeValuesMaker({ ...data, ...condition }, tableKeys),
        ExpressionAttributeNames: ExpressionAttributeNamesMaker({ ...data, ...condition }, tableKeys),
        Key: KeyAttributeMaker(keys),
        ...(condition && { ConditionExpression: ExpressionMaker(condition, EXPRESSION_JOIN.COMA, tableKeys) }),
        ...(returnValues && { ReturnValues: returnValues }),
      });

      const output = (await this.client.send(command as any)) as UpdateCommandOutput;
      return output;
    } catch (e: unknown) {
      const error = e as Error;
      return Promise.reject(new DynamoDBExtendedError(error.message));
    }
  }

    // Query function overloading
    /**
     * Queries items from a DynamoDB table.
     *
     * @param table - The name of the table to query.
     * @param keys - The keys to query.
     * @param limit - The maximum number of items to return.
     * @param scanIndexForward - Whether to scan the index forward.
     * @param indexName - The name of the index to use.
     * @param filters - Additional filters to apply.
     * @returns A promise that resolves to the query result.
     *
     * @example
     * ```typescript
     * const db = new DynamoDBExtendedOperation(client);
     * const result = await db.query<MyDocument>("MyTable", { id: "123" }, 10, true, "MyIndex", { status: "active" });
     * console.log(result.Items);
     * ```
     */
    async query<T extends Persistence>(
        table: string,
        keys: Partial<T>,
        limit?: number,
        scanIndexForward?: boolean,
        indexName?: string,
        filters?: Partial<Filters<T>>
    ): Promise<QueryCommandOutput>

    /**
     * Queries items from a DynamoDB table with pagination support.
     *
     * @param table - The name of the table to query.
     * @param keys - The keys to query.
     * @param limit - The maximum number of items to return.
     * @param scanIndexForward - Whether to scan the index forward.
     * @param indexName - The name of the index to use.
     * @param filters - Additional filters to apply.
     * @param exclusiveStartKey - The primary key of the first item that this operation will evaluate.
     * @returns A promise that resolves to the query result.
     *
     * @example
     * ```typescript
     * const db = new DynamoDBExtendedOperation(client);
     * const result = await db.query<MyDocument>("MyTable", { id: "123" }, 10, true, "MyIndex", { status: "active" }, { id: "lastEvaluatedKey" });
     * console.log(result.Items);
     * ```
     */
    async query<T extends Persistence>(
        table: string,
        keys: Partial<T>,
        limit?: number,
        scanIndexForward?: boolean,
        indexName?: string,
        filters?: Partial<Filters<T>>,
        exclusiveStartKey?: Record<string, NativeAttributeValue>
    ): Promise<QueryCommandOutput>

    // Implementation that handles both definitions
    async query<T extends Persistence>(
        table: string,
        keys: Partial<T>,
        limit?: number,
        scanIndexForward?: boolean,
        indexName?: string,
        filters?: Partial<Filters<T>>,
        exclusiveStartKey?: Record<string, NativeAttributeValue>
    ): Promise<QueryCommandOutput> {
        try {
            const command = new QueryCommand({
                TableName: table,
                ...(exclusiveStartKey && {
                    ExclusiveStartKey: exclusiveStartKey,
                }),
                KeyConditionExpression: ExpressionMaker(
                    keys,
                    EXPRESSION_JOIN.AND
                ),
                ExpressionAttributeValues: {
                    ...ExpressionAttributeValuesMaker(keys),
                    ...FilterExpressionAttributeValuesMaker(filters),
                },
                ExpressionAttributeNames: ExpressionAttributeNamesMaker(keys),
                ...(filters && {
                    FilterExpression: FilterExpressionMaker(
                        filters,
                        EXPRESSION_JOIN.AND
                    ),
                }),
                ...(limit && { Limit: limit }),
                ...(scanIndexForward && { ScanIndexForward: scanIndexForward }),
                ...(indexName && { IndexName: indexName }),
            })

            const output = (await this.client.send(
                command as any
            )) as QueryCommandOutput
            return output
        } catch (e: unknown) {
            const error = e as Error
            return Promise.reject(new DynamoDBExtendedError(error.message))
        }
    }

    async delete<T extends Persistence>(
        table: string,
        keys: Partial<T>
    ): Promise<DeleteCommandOutput> {
        const match = KeyAttributeMaker(keys)
        try {
            const command = new DeleteCommand({
                TableName: table,
                Key: match,
            })

            const output = (await this.client.send(
                command as any
            )) as DeleteCommandOutput
            return output
        } catch (e: unknown) {
            const error = e as Error
            return Promise.reject(new DynamoDBExtendedError(error.message))
        }
    }

    async deleteMultiple<T extends Persistence>(
        table: string,
        keys: Partial<T>[]
    ): Promise<TransactWriteItemsCommandOutput> {
        try {
            const command = new TransactWriteItemsCommand({
                TransactItems: keys.map((key) => ({
                    Delete: {
                        TableName: table,
                        Key: DynamoDBJSONConverter(key),
                    },
                })),
            })

            return await this.client.send(command)
        } catch (e: unknown) {
            const error = e as Error
            return Promise.reject(new DynamoDBExtendedError(error.message))
        }
    }

    async add<T extends Persistence>(
        table: string,
        data: T
    ): Promise<PutCommandOutput> {
        try {
            const command = new PutCommand({
                TableName: table,
                Item:
                    data?.constructor.name !== 'Object'
                        ? marshall(data, { convertClassInstanceToMap: true })
                        : data,
            })

            const output = (await this.client.send(
                command as any
            )) as PutCommandOutput
            return output
        } catch (e: unknown) {
            const error = e as Error
            return Promise.reject(new DynamoDBExtendedError(error.message))
        }
    }

    async scan<T extends Persistence>(
        table: string,
        startKey?: Partial<T>,
        filter?: Partial<T>,
        limit?: number
    ): Promise<ScanCommandOutput> {
        try {
            const command = new ScanCommand({
                TableName: table,
                ...(filter && {
                    FilterExpression: ExpressionMaker(
                        filter,
                        EXPRESSION_JOIN.AND
                    ),
                    ExpressionAttributeValues:
                        ExpressionAttributeValuesMaker(filter),
                    ExpressionAttributeNames:
                        ExpressionAttributeNamesMaker(filter),
                }),
                ...(startKey && { ExclusiveStartKey: startKey }),
                ...(limit && { Limit: limit }),
            })

            const output = (await this.client.send(
                command as any
            )) as ScanCommandOutput
            return output
        } catch (e: unknown) {
            const error = e as Error
            return Promise.reject(new DynamoDBExtendedError(error.message))
        }
    }

    async findOne<T extends Persistence>(
        table: string,
        keys: Partial<T>,
        filter: Partial<T>
    ): Promise<T | undefined> {
        try {
            const command = new QueryCommand({
                TableName: table,
                KeyConditionExpression: ExpressionMaker(
                    keys,
                    EXPRESSION_JOIN.AND
                ),
                ExpressionAttributeValues: ExpressionAttributeValuesMaker({
                    ...keys,
                    ...filter,
                }),
                ExpressionAttributeNames: ExpressionAttributeNamesMaker({
                    ...keys,
                    ...filter,
                }),
                FilterExpression: ExpressionMaker(filter, EXPRESSION_JOIN.AND),
                Limit: 1,
            })

            const output = (await this.client.send(
                command as any
            )) as QueryCommandOutput
            const { Items } = output
            return !Items || !Items.length ? undefined : (Items[0] as T)
        } catch (e: unknown) {
            const error = e as Error
            return Promise.reject(new DynamoDBExtendedError(error.message))
        }
    }

    private async getTableKeys(table: string) {
        const descTableCmd = new DescribeTableCommand({ TableName: table })
        const descOutput = await this.client.send(descTableCmd)
        return descOutput.Table?.KeySchema?.reduce((acc, next) => {
            acc.push(next.AttributeName as string)
            return acc
        }, [] as string[])
    }
}
