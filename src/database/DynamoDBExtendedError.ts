export class DynamoDBExtendedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DynamoDBExtendedError";
    this.message = message;
  }
}
