import { TransactWriteItemsCommandOutput } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommandOutput,
  PutCommandOutput,
  QueryCommandOutput,
  UpdateCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";

export type Persistence = Record<string, NativeAttributeValue> | undefined;

export interface IDynamoDBExtendedOperation {
  add<T extends Persistence>(table: string, data: T): Promise<PutCommandOutput>;
  delete<T extends Persistence>(table: string, keys: Partial<T>): Promise<DeleteCommandOutput>;
  deleteMultiple<T extends Persistence>(
    table: string,
    keys: Partial<T>[],
  ): Promise<TransactWriteItemsCommandOutput>;
  query<T extends Persistence>(table: string, keys: Partial<T>): Promise<QueryCommandOutput>;
  update<T extends Persistence>(
    table: string,
    keys: Partial<T>,
    data: Partial<T>,
  ): Promise<UpdateCommandOutput>;
}
