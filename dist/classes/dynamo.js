"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var cwc_core_js_1 = require("@carwashconnect/cwc-core-js");
var aws_sdk_1 = require("aws-sdk");
var uniqid = __importStar(require("uniqid"));
var BATCH_LIMIT = 100;
var DynamoWrapper = (function () {
    function DynamoWrapper(options, database) {
        this._errors = {
            "MissingTableException": { status: 500, code: "MissingTableException", message: "No dynamo table was provided" },
            "InvalidIdPrefixException": { status: 500, code: "InvalidIdPrefixException", message: "Prefix provided does not match the table" },
            "UniqueIdException": { status: 500, code: "UniqueIdException", message: "Could not generate unique id" },
            "ExceededBatchLimitException": { status: 500, code: "ExceededBatchLimitException", message: "Too many requests for batch function (max: " + BATCH_LIMIT + ")" },
            "NoSingleItemException": { status: 500, code: "NoSingleItemException", message: 'No single item could be identified with the provided data' },
            "MissingUpdateValuesException": { status: 500, code: "MissingUpdateValuesException", message: 'No update values have been provided' }
        };
        this._dateStampColumns = {
            accessed: "dateAccessed",
            created: "dateCreated",
            modified: "dateModified"
        };
        this._options = options;
        this.setOptions(options);
        this._dynamo = database || new aws_sdk_1.DynamoDB.DocumentClient();
        this._generateUniqueString = uniqid.default;
        this._validator = new cwc_core_js_1.Validator();
        this._validator.addLimit("prefix", function (input, prefix) { return input.startsWith(prefix) ? true : false; }, ["string"]);
    }
    DynamoWrapper.prototype.setTable = function (table) { this._table = table; return this; };
    DynamoWrapper.prototype.setOptions = function (options) { this._options = options; return this; };
    DynamoWrapper.prototype.setUniqueStringGenerator = function (func) { this._generateUniqueString = func; return this; };
    Object.defineProperty(DynamoWrapper.prototype, "options", {
        get: function () { return this._options; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(DynamoWrapper.prototype, "table", {
        get: function () { return this._table || null; },
        enumerable: true,
        configurable: true
    });
    ;
    DynamoWrapper.prototype.create = function (input) {
        var _this = this;
        var crudType = "Create";
        return new Promise(function (resolve, reject) {
            var putData = cwc_core_js_1.Objects.trim(cwc_core_js_1.Objects.copy(input));
            if (null == _this.table)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["MissingTableException"]));
            var table = _this.table;
            var createItem = function (validatedPutInput) {
                var now = cwc_core_js_1.Dates.toISO(Date.now());
                validatedPutInput[_this._dateStampColumns.created] = now;
                validatedPutInput[_this._dateStampColumns.modified] = now;
                var putRequest = {
                    TableName: table.tableName[_this.options.stage],
                    ReturnValues: "ALL_NEW",
                    Item: validatedPutInput
                };
                _this._dynamo.put(putRequest, function (err, response) {
                    if (err)
                        return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                    var createOutput = { Attributes: validatedPutInput };
                    _this.log(crudType, createOutput)
                        .then(function () { return resolve(createOutput); })
                        .catch(function () { return resolve(createOutput); });
                });
            };
            if ("undefined" == typeof input[table.columns.id.name]) {
                var key = _this.getKeys(table, input);
                _this.getUniqueId(key)
                    .then(function (id) {
                    input[table.columns.id.name] = id;
                    _this._validator.validate(putData, table.columns)
                        .then(createItem)
                        .catch(reject);
                })
                    .catch(reject);
            }
            else {
                _this._validator.validate(putData, table.columns)
                    .then(createItem)
                    .catch(reject);
            }
        });
    };
    DynamoWrapper.prototype.read = function (filter, requestedAttributes, recordDateAccessed) {
        var _this = this;
        if (recordDateAccessed === void 0) { recordDateAccessed = false; }
        var crudType = "Read";
        return new Promise(function (resolve, reject) {
            if (null == _this.table)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["MissingTableException"]));
            var table = _this.table;
            var scanRequest = {
                TableName: table.tableName[_this._options.stage],
                ScanFilter: filter
            };
            if ("undefined" != typeof requestedAttributes)
                scanRequest.ProjectionExpression = requestedAttributes.join(",");
            _this._dynamo.scan(scanRequest, function (err, response) {
                if (err)
                    return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                if ("undefined" != typeof response.Items && recordDateAccessed) {
                    var updatePromises = [];
                    for (var i in response.Items) {
                        var keys = _this.getKeys(table, response.Items[i]);
                        keys[_this._dateStampColumns.accessed] = cwc_core_js_1.Dates.toISO(Date.now());
                        updatePromises.push(_this.update(keys, true));
                    }
                    Promise.all(updatePromises)
                        .then(function () {
                        return resolve(response);
                    })
                        .catch(function (err) {
                        return reject(err);
                    });
                }
                else {
                    return resolve(response);
                }
            });
        });
    };
    DynamoWrapper.prototype.update = function (input, skipLogging) {
        var _this = this;
        if (skipLogging === void 0) { skipLogging = false; }
        var crudType = "Update";
        return new Promise(function (resolve, reject) {
            var putData = cwc_core_js_1.Objects.trim(cwc_core_js_1.Objects.copy(input));
            if (null == _this.table)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["MissingTableException"]));
            var table = _this.table;
            _this._validator.validate(putData, table.columns)
                .then(function (validatedUpdateInput) {
                var keys = _this.getKeys(table, validatedUpdateInput);
                var scanFilter = {};
                for (var column in keys) {
                    scanFilter[column] = {
                        ComparisonOperator: "EQ",
                        AttributeValueList: [keys[column]]
                    };
                }
                _this.read(scanFilter, [table.columns.id.name], true)
                    .then(function (readResponse) {
                    if (1 != readResponse.Count)
                        return reject(cwc_core_js_1.Errors.stamp(_this._errors["NoSingleItemException"]));
                    var now = cwc_core_js_1.Dates.toISO(Date.now());
                    validatedUpdateInput[_this._dateStampColumns.modified] = now;
                    var updateExpressionList = [];
                    var expressionAttributeNames = {};
                    var expressionAttributeValues = {};
                    var i = 0;
                    for (var column in validatedUpdateInput) {
                        if (table.columns[column].key)
                            continue;
                        i++;
                        expressionAttributeNames["#" + i] = column;
                        expressionAttributeValues[":" + i] = validatedUpdateInput[column];
                        updateExpressionList.push("#" + i + " = " + ":" + i);
                    }
                    if (0 <= Object.keys(expressionAttributeNames).length)
                        return reject(cwc_core_js_1.Errors.stamp(_this._errors["MissingUpdateValuesException"]));
                    var updateRequest = {
                        TableName: table.tableName[_this.options.stage],
                        ReturnValues: "ALL_NEW",
                        Key: keys,
                        ExpressionAttributeNames: expressionAttributeNames,
                        ExpressionAttributeValues: expressionAttributeValues,
                        UpdateExpression: "SET " + updateExpressionList.join(", ")
                    };
                    _this._dynamo.update(updateRequest, function (err, response) {
                        if (err)
                            return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                        if (skipLogging) {
                            return resolve(response);
                        }
                        _this.log(crudType, response)
                            .then(function () { return resolve(response); })
                            .catch(function () { return resolve(response); });
                    });
                })
                    .catch(reject);
            })
                .catch(reject);
        });
    };
    DynamoWrapper.prototype.delete = function (input) {
        var _this = this;
        var crudType = "Delete";
        return new Promise(function (resolve, reject) {
            var deleteData = cwc_core_js_1.Objects.trim(cwc_core_js_1.Objects.copy(input));
            if (null == _this.table)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["MissingTableException"]));
            var table = _this.table;
            _this._validator.validate(deleteData, table.columns)
                .then(function (validatedUpdateInput) {
                var keys = _this.getKeys(table, validatedUpdateInput);
                var deleteRequest = {
                    TableName: table.tableName[_this.options.stage],
                    Key: keys,
                    ReturnValues: "ALL_OLD"
                };
                _this._dynamo.delete(deleteRequest, function (err, response) {
                    if (err)
                        return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                    _this.log(crudType, response)
                        .then(function () { return resolve(response); })
                        .catch(function () { return resolve(response); });
                });
            }).catch(reject);
        });
    };
    DynamoWrapper.prototype.batchRead = function (keys, requestedAttributes) {
        var _this = this;
        var crudType = "BatchRead";
        return new Promise(function (resolve, reject) {
            if (keys.length > BATCH_LIMIT)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["ExceededBatchLimitException"]));
            if (null == _this.table)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["MissingTableException"]));
            var table = _this.table;
            var validationPromises = [];
            for (var i in keys) {
                var validator = new cwc_core_js_1.Validator();
                validator.addLimit("prefix", function (input, prefix) { return input.startsWith(prefix) ? true : false; }, ["string"]);
                validationPromises.push(validator.validate(keys[i], table.columns));
            }
            Promise.all(validationPromises)
                .then(function (validatedKeys) {
                var _a;
                var keysAndAttributes = {
                    Keys: validatedKeys
                };
                if ("undefined" != typeof requestedAttributes)
                    keysAndAttributes.ProjectionExpression = requestedAttributes.join(",");
                var requestedItems = (_a = {},
                    _a[table.tableName[_this.options.stage]] = keysAndAttributes,
                    _a);
                var batchRequest = {
                    RequestItems: requestedItems
                };
                var executeBatchRead = function (request) {
                    return new Promise(function (readResolve, readReject) {
                        _this._dynamo.batchGet(batchRequest, function (err, response) {
                            if (err)
                                return readReject(cwc_core_js_1.Errors.awsErrorToIError(err));
                            var responseData = [];
                            if ("undefined" != typeof response.Responses) {
                                responseData = response.Responses[table.tableName[_this.options.stage]];
                            }
                            if ("undefined" != typeof response.UnprocessedKeys) {
                                executeBatchRead({ RequestItems: response.UnprocessedKeys })
                                    .then(function (unprocessedResponseData) {
                                    responseData = responseData.concat(unprocessedResponseData);
                                    return readResolve(responseData);
                                }).catch(readReject);
                            }
                            else {
                                readResolve(responseData);
                            }
                        });
                    });
                };
                executeBatchRead(batchRequest)
                    .then(function (data) {
                    _this.log(crudType, data)
                        .then(function () { return resolve(data); })
                        .catch(function () { return resolve(data); });
                }).catch(reject);
            })
                .catch(reject);
        });
    };
    DynamoWrapper.prototype.log = function (crudType, input) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var _a;
            var data = cwc_core_js_1.Objects.trim(cwc_core_js_1.Objects.copy(input));
            if (null == _this.table)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["MissingTableException"]));
            var table = _this.table;
            if ("undefined" == typeof table.logTableName) {
                console.log("Table log: No log table provided, skipping log");
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["MissingTableException"]));
            }
            var now = Date.now();
            var putData = (_a = {
                    logId: "log_" + _this._generateUniqueString() + "-" + now,
                    tableName: table.tableName[_this._options.stage],
                    affectedElements: Array.isArray(data) ? data : [data],
                    crudType: crudType,
                    service: _this.options.service || "UNKNOWN",
                    stage: _this.options.stage,
                    call: _this.options.call || "UNKNOWN",
                    userData: _this.options.userData || {}
                },
                _a[_this._dateStampColumns.created] = now,
                _a[_this._dateStampColumns.modified] = now,
                _a);
            var putRequest = {
                TableName: table.logTableName[_this.options.stage],
                ReturnValues: "ALL_OLD",
                Item: putData
            };
            _this._dynamo.put(putRequest, function (err, response) {
                if (err)
                    return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                var logOutput = { Attributes: putData };
                resolve(logOutput);
            });
        });
    };
    DynamoWrapper.prototype.getKeys = function (table, data) {
        if (data === void 0) { data = {}; }
        var _a;
        var keys = (_a = {},
            _a[table.columns.id.name] = data[table.columns.id.name] || null,
            _a);
        for (var columnName in table.columns) {
            if ("id" == columnName)
                continue;
            var column = table.columns[columnName];
            if (column.key)
                keys[column.name] = data[column.name] || null;
        }
        return keys;
    };
    DynamoWrapper.prototype.getUniqueId = function (key) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var GENERATED_UNIQUE_ID_COUNT = 5;
            var testKeys = [];
            if (null == _this.table)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["MissingTableException"]));
            var table = _this.table;
            for (var i = 0; i < GENERATED_UNIQUE_ID_COUNT; i++) {
                var tempKey = cwc_core_js_1.Objects.copy(key);
                var uniqueId = table.columns.id.prefix + _this._generateUniqueString();
                tempKey[table.columns.id.name] = uniqueId;
                testKeys.push(tempKey);
            }
            _this.batchRead(testKeys, [table.columns.id.name])
                .then(function (data) {
                for (var i in testKeys) {
                    var found = false;
                    var id = testKeys[i][table.columns.id.name];
                    for (var j in data) {
                        if (data[j][table.columns.id.name] == id) {
                            found = true;
                            break;
                        }
                    }
                    if (!found)
                        return testKeys[i][table.columns.id.name];
                }
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["UniqueIdException"]));
            })
                .catch(reject);
        });
    };
    return DynamoWrapper;
}());
exports.DynamoWrapper = DynamoWrapper;
//# sourceMappingURL=dynamo.js.map