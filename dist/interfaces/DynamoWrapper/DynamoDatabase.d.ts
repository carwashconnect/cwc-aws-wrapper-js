import { DynamoDB } from "aws-sdk";
import { AWSCallback } from "../AWSCallback";
export interface DynamoDatabase {
    delete: (data: DynamoDB.DocumentClient.DeleteItemInput, callback: AWSCallback) => any;
    batchGet: (data: DynamoDB.DocumentClient.BatchGetItemInput, callback: AWSCallback) => any;
    put: (data: DynamoDB.DocumentClient.PutItemInput, callback: AWSCallback) => any;
    scan: (data: DynamoDB.DocumentClient.ScanInput, callback: AWSCallback) => any;
    update: (data: DynamoDB.DocumentClient.UpdateItemInput, callback: AWSCallback) => any;
}
