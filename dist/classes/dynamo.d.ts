import { IError, Validator } from "@carwashconnect/cwc-core-js";
import { DynamoWrapperOptions, DynamoDatabase, DynamoWrapperTable } from "../interfaces/DynamoWrapper.barrel";
import { DynamoDB } from "aws-sdk";
export declare class DynamoWrapper {
    protected _dynamo: DynamoDatabase;
    protected _options: DynamoWrapperOptions;
    protected _table?: DynamoWrapperTable;
    protected _validator: Validator;
    protected _generateUniqueString: () => string;
    protected _errors: {
        [key: string]: IError;
    };
    protected _dateStampColumns: {
        accessed: string;
        created: string;
        modified: string;
        [key: string]: string;
    };
    constructor(options: DynamoWrapperOptions, database?: DynamoDatabase);
    setTable(table: DynamoWrapperTable): DynamoWrapper;
    setOptions(options: DynamoWrapperOptions): DynamoWrapper;
    setUniqueStringGenerator(func: () => string): DynamoWrapper;
    readonly options: DynamoWrapperOptions;
    readonly table: DynamoWrapperTable | null;
    create(input: DynamoDB.DocumentClient.PutItemInputAttributeMap): Promise<DynamoDB.DocumentClient.PutItemOutput>;
    read(filter: DynamoDB.DocumentClient.FilterConditionMap, requestedAttributes?: string[]): Promise<DynamoDB.DocumentClient.ScanOutput>;
    update(input: DynamoDB.DocumentClient.PutItemInputAttributeMap): Promise<DynamoDB.DocumentClient.UpdateItemOutput>;
    delete(input: DynamoDB.DocumentClient.PutItemInputAttributeMap): Promise<DynamoDB.DocumentClient.DeleteItemOutput>;
    batchRead(keys: DynamoDB.DocumentClient.Key[], requestedAttributes?: string[]): Promise<DynamoDB.DocumentClient.AttributeMap[]>;
    protected log(crudType: string, input: {
        [key: string]: any;
    }): Promise<DynamoDB.DocumentClient.PutItemOutput>;
    getKeys(table: DynamoWrapperTable, data?: {
        [key: string]: any;
    }): DynamoDB.DocumentClient.Key;
    getUniqueId(key?: DynamoDB.DocumentClient.Key): Promise<string>;
}
