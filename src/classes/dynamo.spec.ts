import { DynamoWrapper } from "./dynamo"
import { DynamoDatabase, DynamoWrapperTable } from "../interfaces/DynamoWrapper.barrel"
import { DynamoDB, AWSError } from "aws-sdk";
import { AWSCallback } from "../interfaces/AWSCallback";
import { Objects } from "@carwashconnect/cwc-core-js";

type Storage = { [key: string]: any }[];
class FakeDatabase implements DynamoDatabase {

    public tables: { [key: string]: Storage };

    constructor() {
        this.tables = {};
    }

    public delete(data: DynamoDB.DocumentClient.DeleteItemInput, callback?: (error: AWSError | null, response?: DynamoDB.DocumentClient.DeleteItemOutput) => void): any {
        this.tables[data.TableName] = this.tables[data.TableName] || [];
        let storage: Storage = this.tables[data.TableName];
        let results = storage.filter((elem) => {
            let isValid = true;
            for (let column in data.Key)
                isValid = isValid && (data.Key[column] == elem[column])
            return isValid;
        })

        //Check for the number of results
        if (1 == results.length) {

            //Copy the element
            let deleteOutput: DynamoDB.DocumentClient.DeleteItemOutput = {};
            if ("ALL_OLD" == data.ReturnValues) deleteOutput.Attributes = Objects.copy(results[0]);

            //Delete the element
            let i: number = storage.indexOf(results[0])
            this.tables[data.TableName].splice(i, 1);

            //Resolve 
            if (callback) callback(null, deleteOutput);

        } else {

            //Can't delete
            if (callback) callback(<AWSError>{ message: "No single item", code: "NoSingleItemException", statusCode: 500 })

        }

    };

    //Only returns one element for testing purposes
    public batchGet(data: DynamoDB.DocumentClient.BatchGetItemInput, callback?: (error: AWSError | null, response?: DynamoDB.DocumentClient.BatchGetItemOutput) => void): any {
        let batchResponse: DynamoDB.DocumentClient.BatchGetItemOutput = {
            Responses: {}
        };

        for (let tableName in data.RequestItems) {
            this.tables[tableName] = this.tables[tableName] || [];
            let storage: Storage = this.tables[tableName]
            let item = data.RequestItems[tableName];
            let results: Storage = storage.filter((elem) => {
                let isValid = true;
                for (let column in item.Keys[0])
                    isValid = isValid && (item.Keys[0][column] == elem[column])
                return isValid;
            })

            if ("undefined" != typeof batchResponse.Responses) batchResponse.Responses[tableName] = results;

            //Remove the first key
            let deleted = data.RequestItems[tableName].Keys.splice(0, 1);

            //Removed the table if everything has been processed
            if (0 == data.RequestItems[tableName].Keys.length) delete data.RequestItems[tableName]
        }

        if (Object.keys(data.RequestItems).length) batchResponse.UnprocessedKeys = data.RequestItems;

        if (callback) callback(null, batchResponse);
    };

    public put(data: DynamoDB.DocumentClient.PutItemInput, callback?: (error: AWSError | null, response?: DynamoDB.DocumentClient.PutItemOutput) => void): any {
        this.tables[data.TableName] = this.tables[data.TableName] || [];
        this.tables[data.TableName].push(data);
        if (callback) callback(null, {})
    };

    public scan(data: DynamoDB.DocumentClient.ScanInput, callback?: (error: AWSError | null, response?: DynamoDB.DocumentClient.ScanOutput) => void): any {
        this.tables[data.TableName] = this.tables[data.TableName] || [];
        let storage: Storage = this.tables[data.TableName];
        let results = storage.filter((elem) => {
            let isValid = true;



            return isValid;
        })

        let scanOutput: DynamoDB.DocumentClient.ScanOutput = {
            Count: results.length,
            Items: results
        }

        if (callback) callback(null, scanOutput);
    };

    public update(data: DynamoDB.DocumentClient.UpdateItemInput, callback?: (error: AWSError | null, response?: DynamoDB.DocumentClient.UpdateItemOutput) => void): any {
        this.tables[data.TableName] = this.tables[data.TableName] || [];
        let storage: Storage = this.tables[data.TableName];
        let results = storage.filter((elem) => {
            let isValid = true;



            return isValid;
        })


        let updateOutput: DynamoDB.DocumentClient.UpdateItemOutput = {}
        if ("ALL_NEW" == data.ReturnValues) updateOutput.Attributes = {};
        if (callback) callback(null, updateOutput);
    };

}

describe("DynamoWrapper", function () {

    let myDB = new FakeDatabase();
    let dynamo = new DynamoWrapper({ stage: "prod" }, myDB);

    let myTable: DynamoWrapperTable = {
        name: "myTable",
        tableName: {
            "prod": "derp"
        },
        columns: {
            id: {
                name: "id",
                required: true,
                key: true,
                validationType: ["string"],
                prefix: "id_"
            },
            data: {
                name: "data",
                validationType: ["object"]
            }
        }
    }
    it(" should initialize", function () {
        expect(dynamo.table).toEqual(null);

    });

    it(".setTable() should set the database table", function () {
        dynamo.setTable(myTable);
        expect(dynamo.table).toEqual(myTable);
    });

    it(".create() should generate its own id", function () {
        dynamo.setTable(myTable);
        let beforeSize = myDB.tables[myTable.tableName["prod"]] ? myDB.tables[myTable.tableName["prod"]].length : 0;
        dynamo.create({})
            .then(data => {
                let afterSize = myDB.tables[myTable.tableName["prod"]].length
                console.log("My data:", data);
                expect(afterSize).toEqual(beforeSize + 1);

            })
            .catch(() => {
                console.log("My error");
                expect(true).toEqual(false)
            })

    });

    it(".create() should add to the database", function () {
        dynamo.setTable(myTable);

        expect(dynamo.table).toEqual(myTable);
    });



});
