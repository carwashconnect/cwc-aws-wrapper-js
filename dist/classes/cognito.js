"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var cwc_core_js_1 = require("@carwashconnect/cwc-core-js");
var BATCH_LIMIT = 100;
var CognitoWrapper = (function () {
    function CognitoWrapper(options) {
        this._validUserAttributes = {};
        this._errors = {
            "InvalidISPException": { status: 500, code: "InvalidISPException", message: "Cognito identity service provider is missing or not configured" },
            "ExceededBatchLimitException": { status: 500, code: "ExceededBatchLimitException", message: "Too many requests for batch function (max: " + BATCH_LIMIT + ")" }
        };
        this._options = options;
    }
    CognitoWrapper.prototype.setIdentityServiceProvider = function (isp) {
        this._cognito = isp;
        return this;
    };
    CognitoWrapper.prototype.setAcceptedUserAttributes = function (attributes) {
        this._validUserAttributes = attributes;
        return this;
    };
    CognitoWrapper.prototype.getValidAttributes = function (userAttributes) {
        var validUserAttributes = [];
        for (var attr in this._validUserAttributes) {
            if ("string" == typeof userAttributes[attr]) {
                validUserAttributes.push({
                    Name: this._validUserAttributes[attr],
                    Value: userAttributes[attr]
                });
            }
        }
        return validUserAttributes;
    };
    CognitoWrapper.prototype.register = function (email, password, userAttributes) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if ("undefined" == typeof _this._cognito)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["InvalidISPException"]));
            var validUserAttributes = _this.getValidAttributes(userAttributes);
            var signUpRequest = {
                ClientId: _this._options.clientId,
                Username: email,
                Password: password,
                UserAttributes: validUserAttributes
            };
            _this._cognito.signUp(signUpRequest, function (err, data) {
                if (err)
                    return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                return resolve(data);
            });
        });
    };
    CognitoWrapper.prototype.batchRegister = function (emails) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (BATCH_LIMIT < emails.length)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["ExceededBatchLimitException"]));
            var registrationPromises = [];
            var _loop_1 = function (email) {
                var batchRegisterRequest = {
                    UserPoolId: _this._options.userPool,
                    Username: email,
                    UserAttributes: [
                        { Name: "email_verified", Value: "True" },
                        { Name: "email", Value: email }
                    ],
                    DesiredDeliveryMediums: ["EMAIL"]
                };
                registrationPromises.push(new Promise(function (registrationResolve, registrationReject) {
                    if ("undefined" == typeof _this._cognito)
                        return reject(cwc_core_js_1.Errors.stamp(_this._errors["InvalidISPException"]));
                    _this._cognito.adminCreateUser(batchRegisterRequest, function (err, data) {
                        if (err)
                            return registrationReject(err);
                        return registrationResolve(data);
                    });
                }));
            };
            for (var _i = 0, emails_1 = emails; _i < emails_1.length; _i++) {
                var email = emails_1[_i];
                _loop_1(email);
            }
            Promise.all(registrationPromises)
                .then(function (data) { return resolve(data); })
                .catch(function (err) { return reject(cwc_core_js_1.Errors.awsErrorToIError(err)); });
        });
    };
    CognitoWrapper.prototype.login = function (email, password) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if ("undefined" == typeof _this._cognito)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["InvalidISPException"]));
            var loginRequest = {
                AuthFlow: "ADMIN_NO_SRP_AUTH",
                ClientId: _this._options.clientId,
                UserPoolId: _this._options.userPool,
                AuthParameters: { USERNAME: email, PASSWORD: password }
            };
            _this._cognito.adminInitiateAuth(loginRequest, function (err, data) {
                if (err)
                    return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                return resolve(data);
            });
        });
    };
    CognitoWrapper.prototype.logout = function (email) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if ("undefined" == typeof _this._cognito)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["InvalidISPException"]));
            var logoutRequest = {
                UserPoolId: _this._options.userPool,
                Username: email
            };
            _this._cognito.adminUserGlobalSignOut(logoutRequest, function (err, data) {
                if (err)
                    return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                return resolve(data);
            });
        });
    };
    CognitoWrapper.prototype.refreshTokens = function (email, refreshToken, deviceKey) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if ("undefined" == typeof _this._cognito)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["InvalidISPException"]));
            var authParameters = { USERNAME: email, REFRESH_TOKEN: refreshToken };
            if ("undefined" != typeof deviceKey)
                authParameters["DEVICE_KEY"] = deviceKey;
            var loginRequest = {
                AuthFlow: "REFRESH_TOKEN",
                ClientId: _this._options.clientId,
                UserPoolId: _this._options.userPool,
                AuthParameters: authParameters
            };
            _this._cognito.adminInitiateAuth(loginRequest, function (err, data) {
                if (err)
                    return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                return resolve(data);
            });
        });
    };
    CognitoWrapper.prototype.forgotPassword = function (email) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if ("undefined" == typeof _this._cognito)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["InvalidISPException"]));
            var forgotPasswordRequest = {
                ClientId: _this._options.clientId,
                Username: email
            };
            _this._cognito.forgotPassword(forgotPasswordRequest, function (err, data) {
                if (err)
                    return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                return resolve(data);
            });
        });
    };
    CognitoWrapper.prototype.confirmForgotPassword = function (email, password, confirmationCode) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if ("undefined" == typeof _this._cognito)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["InvalidISPException"]));
            var confirmForgotPasswordRequest = {
                ClientId: _this._options.clientId,
                Username: email,
                Password: password,
                ConfirmationCode: confirmationCode
            };
            _this._cognito.confirmForgotPassword(confirmForgotPasswordRequest, function (err, data) {
                if (err)
                    return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                return resolve(data);
            });
        });
    };
    CognitoWrapper.prototype.changePassword = function (accessToken, oldPassword, newPassword) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if ("undefined" == typeof _this._cognito)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["InvalidISPException"]));
            var passwordChangeRequest = {
                AccessToken: accessToken,
                PreviousPassword: oldPassword,
                ProposedPassword: newPassword
            };
            _this._cognito.changePassword(passwordChangeRequest, function (err, data) {
                if (err)
                    return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                return resolve(data);
            });
        });
    };
    CognitoWrapper.prototype.respondToAuthChallenge = function (email, challegeName, session, challengeResponses, userAttributes) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if ("undefined" == typeof _this._cognito)
                return reject(cwc_core_js_1.Errors.stamp(_this._errors["InvalidISPException"]));
            challegeName = challegeName.toUpperCase();
            var challengeResponse = { USERNAME: email };
            for (var key in challengeResponses) {
                if ("undefined" != typeof challengeResponses[key])
                    challengeResponse[key] = challengeResponses[key];
            }
            for (var attr in _this._validUserAttributes) {
                if ("string" == typeof userAttributes[attr]) {
                    challengeResponse["userAttributes." + _this._validUserAttributes[attr]] = userAttributes[attr];
                }
            }
            var authChallengeRequest = {
                ChallengeName: challegeName,
                ClientId: _this._options.clientId,
                UserPoolId: _this._options.userPool,
                ChallengeResponses: challengeResponse,
                Session: session
            };
            _this._cognito.adminRespondToAuthChallenge(authChallengeRequest, function (err, data) {
                if (err)
                    return reject(cwc_core_js_1.Errors.awsErrorToIError(err));
                return resolve(data);
            });
        });
    };
    return CognitoWrapper;
}());
exports.CognitoWrapper = CognitoWrapper;
//# sourceMappingURL=cognito.js.map