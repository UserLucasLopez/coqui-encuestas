import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let documentClient: DynamoDBDocumentClient | null = null;

export function getDynamoDocumentClient() {
  if (documentClient) {
    return documentClient;
  }

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
  });

  documentClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  return documentClient;
}

export function getRoomsTableName() {
  const tableName = process.env.DYNAMODB_TABLE_NAME;

  if (!tableName) {
    throw new Error("Missing DYNAMODB_TABLE_NAME environment variable.");
  }

  return tableName;
}
