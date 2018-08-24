import { IError, Objects, Errors, Validator, Dates } from "@carwashconnect/cwc-core-js";
import { DynamoWrapperOptions, DynamoDatabase, DynamoWrapperTable } from "../interfaces/DynamoWrapper.barrel";
import { DynamoDB, AWSError } from "aws-sdk";
import { AWSCallback } from "../interfaces/AWSCallback";
import * as uniqid from "uniqid"
import { KeysAndAttributes } from "aws-sdk/clients/dynamodb";

const BATCH_LIMIT: number = 100;
export class DynamoWrapper {

    protected _dynamo: DynamoDatabase;
    protected _options: DynamoWrapperOptions;
    protected _table?: DynamoWrapperTable;
    protected _generateUniqueString: () => string;

    protected _errors: { [key: string]: IError } = {
        "MissingTableException": { status: 500, code: "MissingTableException", message: "No dynamo table was provided" },
        "InvalidIdPrefixException": { status: 500, code: "InvalidIdPrefixException", message: "Prefix provided does not match the table" },
        "UniqueIdException": { status: 500, code: "UniqueIdException", message: "Could not generate unique id" },
        "ExceededBatchLimitException": { status: 500, code: "ExceededBatchLimitException", message: `Too many requests for batch function (max: ${BATCH_LIMIT})` }
    };

    protected _dateStampColumns: { accessed: string, created: string, modified: string, [key: string]: string } = {
        accessed: "dateAccessed",
        created: "dateCreated",
        modified: "dateModified"
    }

    constructor(options: DynamoWrapperOptions, database?: DynamoDatabase) {

        //Don't ask, VSC can't handle this nicely
        this._options = options;
        this.setOptions(options);

        //Set the database
        this._dynamo = database || new DynamoDB.DocumentClient();

        //Set the string generator
        this._generateUniqueString = uniqid.default;

    }

    //----------------------------------------
    //-Set Functions--------------------------
    //----------------------------------------

    public setTable(table: DynamoWrapperTable): DynamoWrapper { this._table = table; return this; }
    public setOptions(options: DynamoWrapperOptions): DynamoWrapper { this._options = options; return this; }
    public setUniqueStringGenerator(func: () => string): DynamoWrapper { this._generateUniqueString = func; return this; }

    //----------------------------------------
    //-Get Functions--------------------------
    //----------------------------------------

    public get options(): DynamoWrapperOptions { return this._options };
    public get table(): DynamoWrapperTable | null { return this._table || null };

    //----------------------------------------
    //-CRUD Functions-------------------------
    //----------------------------------------

    public create(input: DynamoDB.DocumentClient.PutItemInputAttributeMap): Promise<DynamoDB.DocumentClient.ScanOutput> {
        let crudType: string = "Create";
        return new Promise((resolve, reject) => {

            //Remove empty strings from the data object
            let putData: DynamoDB.DocumentClient.PutItemInputAttributeMap = Objects.trim(Objects.copy(input));

            //Copy the table
            if (null == this.table) return reject(Errors.stamp(this._errors["MissingTableException"]))
            let table: DynamoWrapperTable = this.table;

            // Get the table keys
            let keys: DynamoDB.DocumentClient.Key = this.getKeys(table, putData);

            //TODO Generate ID if we don't have one

            //Validate the inputs
            let validator: Validator = new Validator();
            validator.validate(putData, table.columns)
                .then((validatedPutInput: DynamoDB.DocumentClient.PutItemInputAttributeMap) => {

                    // Update the timestamps
                    let now: number = Date.now();
                    validatedPutInput[this._dateStampColumns.created] = now;
                    validatedPutInput[this._dateStampColumns.modified] = now;

                    // Create the put data
                    let putRequest: DynamoDB.DocumentClient.PutItemInput = {
                        TableName: table.tableName[this.options.stage],
                        ReturnValues: "ALL_NEW",
                        Item: validatedPutInput
                    };

                    // Execute the call
                    this._dynamo.put(putRequest, (err: AWSError, response?: DynamoDB.DocumentClient.PutItemInput) => {

                        //Check for an error
                        if (err) return reject(Errors.awsErrorToIError(err));

                        //Create the output
                        let createOutput: DynamoDB.DocumentClient.ScanOutput = { Count: 1, Items: [validatedPutInput] }

                        // Log the data
                        this.log(crudType, validatedPutInput)
                            .then(() => { return resolve(createOutput) })
                            .catch(() => { return resolve(createOutput) })

                    });

                })
                .catch(reject);

        })
    }

    public read(filter: DynamoDB.DocumentClient.FilterConditionMap, requestedAttributes?: string[]): Promise<DynamoDB.DocumentClient.ScanOutput> {
        let crudType = "Read";
        return new Promise((resolve, reject) => {

            //Copy the table
            if (null == this.table) return reject(Errors.stamp(this._errors["MissingTableException"]))
            let table: DynamoWrapperTable = this.table;

            //Prepare the scan request
            let scanRequest: DynamoDB.DocumentClient.ScanInput = {
                TableName: table.tableName[this._options.stage],
                ScanFilter: filter
            }
            if ("undefined" != typeof requestedAttributes) scanRequest.ProjectionExpression = requestedAttributes.join(",");

            //Request from the database
            this._dynamo.scan(scanRequest, (err: AWSError, response: DynamoDB.DocumentClient.ScanOutput) => {

                //Check for an error
                if (err) return reject(Errors.awsErrorToIError(err));

                // Log the data
                this.log(crudType, response)
                    .then(() => { return resolve(response) })
                    .catch(() => { return resolve(response) })

            });

        });
    }

    //----------------------------------------
    //-Advanced Functions---------------------
    //----------------------------------------

    public batchRead(keys: DynamoDB.DocumentClient.Key[], requestedAttributes?: string[]): Promise<DynamoDB.DocumentClient.AttributeMap[]> {
        let crudType = "BatchRead";
        return new Promise((resolve, reject) => {

            //Check if we're handling too many elements
            if (keys.length > BATCH_LIMIT) return reject(Errors.stamp(this._errors["ExceededBatchLimitException"]))

            //Copy the table
            if (null == this.table) return reject(Errors.stamp(this._errors["MissingTableException"]))
            let table: DynamoWrapperTable = this.table;

            //Create the validation promises
            let validator = new Validator();
            let validationPromises: Promise<any>[] = [];
            for (let i in keys) {
                validationPromises.push(validator.validate(keys[i], table.columns))
            }

            //Validate the input
            Promise.all(validationPromises)
                .then((validatedKeys: DynamoDB.DocumentClient.Key[]) => {

                    //Prepare the batch get request
                    let keysAndAttributes: DynamoDB.KeysAndAttributes = {
                        Keys: validatedKeys
                    }
                    if ("undefined" != typeof requestedAttributes) keysAndAttributes.ProjectionExpression = requestedAttributes.join(",");
                    let requestedItems: DynamoDB.DocumentClient.BatchGetRequestMap = {
                        [table.tableName[this.options.stage]]: keysAndAttributes
                    }
                    let batchRequest: DynamoDB.DocumentClient.BatchGetItemInput = {
                        RequestItems: requestedItems
                    }

                    //This is a function because we have some recursion to handle unprocessed keys
                    let executeBatchRead: (request: DynamoDB.DocumentClient.BatchGetItemInput) => Promise<DynamoDB.DocumentClient.AttributeMap[]> = (request: DynamoDB.DocumentClient.BatchGetItemInput) => {
                        return new Promise((readResolve, readReject) => {

                            //Request from the database
                            this._dynamo.batchGet(batchRequest, (err: AWSError, response: DynamoDB.DocumentClient.BatchGetItemOutput) => {

                                //Check for an error
                                if (err) return readReject(Errors.awsErrorToIError(err));

                                //Copy the data
                                let responseData: DynamoDB.DocumentClient.AttributeMap[] = [];
                                if ("undefined" != typeof response.Responses) {
                                    responseData = response.Responses[table.tableName[this.options.stage]];
                                }

                                //Check if there were unprocessed keys
                                if ("undefined" != typeof response.UnprocessedKeys) {
                                    executeBatchRead({ RequestItems: response.UnprocessedKeys })
                                        .then((unprocessedResponseData: DynamoDB.DocumentClient.AttributeMap[]) => {

                                            //Add the new data
                                            responseData = responseData.concat(unprocessedResponseData);

                                            //Resolve the call
                                            return readResolve(responseData);

                                        }).catch(readReject);
                                } else {

                                    //Resolve the call
                                    readResolve(responseData)

                                }

                            });

                        })
                    }

                    //Execute the read
                    executeBatchRead(batchRequest)
                        .then((data: DynamoDB.DocumentClient.AttributeMap[]) => {

                            // Log the data
                            this.log(crudType, data)
                                .then(() => { return resolve(data) })
                                .catch(() => { return resolve(data) })

                        }).catch(reject);

                })
                .catch(reject);

        });
    }

    log(crudType: string, input: { [key: string]: any }): Promise<{ [key: string]: any }> {
        return new Promise((resolve, reject) => {

            // Remove empty string from the data object
            let data: { [key: string]: any } = Objects.trim(Objects.copy(input));

            //Copy the table
            if (null == this.table) return reject(Errors.stamp(this._errors["MissingTableException"]))
            let table: DynamoWrapperTable = this.table;

            // Check if there is an associated log table
            if (!table.logTableName) {
                console.log("Table log: No log table provided, skipping log")
                return reject(Errors.stamp(this._errors["MissingTableException"]));
            }

            let now: number = Date.now();

            // Create the put data
            let putData: { [key: string]: any } = {
                logId: "log_" + this._generateUniqueString() + "-" + now,
                affectedElements: Array.isArray(data) ? data : [data],
                crudType: crudType,
                service: this.options.service || "UNKNOWN",
                stage: this.options.stage,
                call: this.options.call || "UNKNOWN",
                userData: this.options.userData || {},
                [this._dateStampColumns.created]: now,
                [this._dateStampColumns.modified]: now
            }

            // Create the put request
            let putRequest: DynamoDB.DocumentClient.PutItemInput = {
                TableName: table.logTableName[this.options.stage],
                ReturnValues: "ALL_OLD",
                Item: putData
            }

            // Execute the put
            this._dynamo.put(putRequest, (err: AWSError, response?: DynamoDB.DocumentClient.PutItemOutput) => {

                //Check for an error
                if (err) return reject(Errors.awsErrorToIError(err));

                // Log the data
                resolve(putData)

            });

        })
    }


    //----------------------------------------
    //-Utility Functions----------------------
    //----------------------------------------

    // Gets the keys marked in the table structure
    public getKeys(table: DynamoWrapperTable, data: { [key: string]: any } = {}): DynamoDB.DocumentClient.Key {

        //Set the primary key
        let keys: DynamoDB.DocumentClient.Key = {
            [table.columns.id.name]: data[table.columns.id.name] || null
        }

        // Set the secondary keys
        for (let columnName in table.columns) {

            // Skip the id
            if ("id" == columnName) continue;

            // Get the column
            let column: { name: string, key?: boolean } = table.columns[columnName];

            // If the column is marked as a key add it to the array
            if (column.key) keys[column.name] = data[column.name] || null

        }

        // Return the keys
        return keys;

    }

    // Gets the keys marked in the table structure
    public getUniqueId(key?: DynamoDB.DocumentClient.Key[]): Promise<string> {

        return new Promise((resolve, reject) => {
            let GENERATED_UNIQUE_ID_COUNT: number = 5;
            let testKeys: DynamoDB.DocumentClient.Key[] = []

            //Copy the table
            if (null == this.table) return reject(Errors.stamp(this._errors["MissingTableException"]))
            let table: DynamoWrapperTable = this.table;

            //Generate the unique ids
            for (let i = 0; i < GENERATED_UNIQUE_ID_COUNT; i++) {

                //Copy the secondary keys
                let tempKey: DynamoDB.DocumentClient.Key = Objects.copy(key);

                //Generate an id
                let uniqueId: string = table.columns.id.prefix + this._generateUniqueString()

                //Copy as the primary key
                tempKey[table.columns.id.name] = uniqueId;

                //Add to the test keys array
                testKeys.push(tempKey);
            }

            //Execute a batch read request
            this.batchRead(testKeys, [table.columns.id.name])
                .then((data: DynamoDB.DocumentClient.AttributeMap[]) => {

                    //Loop through the test unique ids
                    for (let i in testKeys) {

                        //Copy values
                        let found: boolean = false;
                        let id: string = testKeys[i][table.columns.id.name];

                        //Loop through the table data
                        for (let j in data) {

                            //Check if there an id match
                            if (data[j][table.columns.id.name] == id) {
                                found = true;
                                break;
                            }

                        }

                        //If we didn't find a result return the unique id
                        if (!found) return testKeys[i][table.columns.id.name]

                    }

                    //We didn't find a unique id this time
                    return reject(Errors.stamp(this._errors["UniqueIdException"]))
                })
                .catch(reject);

        })

    }

}