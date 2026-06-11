import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let documentClient: DynamoDBDocumentClient | null = null;

export function getDynamoDocumentClient() {
  if (documentClient) {
    return documentClient;
  }

  const client = new DynamoDBClient({
    region: "sa-east-1",
  });

  documentClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  return documentClient;
}

export function getRoomsTableName() {
  const tableName = "coqui-encuestas";

  if (!tableName) {
    throw new Error("Missing 'coqui-encuestas' environment variable.");
  }

  return tableName;
}
