import { CognitoIdentityServiceProvider, AWSError } from "aws-sdk"
import { CognitoWrapperOptions, CognitoAuthChallengeResponses, IdentityServiceProvider } from "../interfaces/CognitoWrapper.barrel";
import { IError, Errors } from "@carwashconnect/cwc-core-js";

const BATCH_LIMIT: number = 100;
export class CognitoWrapper {

    private _options: CognitoWrapperOptions;
    private _cognito: IdentityServiceProvider | undefined;
    private _validUserAttributes: { [key: string]: string } = {};

    private _errors: { [key: string]: IError } = {
        "InvalidISPException": { status: 500, code: "InvalidISPException", message: "Cognito identity service provider is missing or not configured" },
        "ExceededBatchLimitException": { status: 500, code: "ExceededBatchLimitException", message: `Too many requests for batch function (max: ${BATCH_LIMIT})` }
    };

    constructor(options: CognitoWrapperOptions) {
        this._options = options;
    }

    public setIdentityServiceProvider(isp: IdentityServiceProvider): CognitoWrapper {
        this._cognito = isp;
        return this;
    }

    public setAcceptedUserAttributes(attributes: { [key: string]: string }): CognitoWrapper {
        this._validUserAttributes = attributes;
        return this;
    }

    //Checks which of the provide attributes is valid for the cognito wrapper instance
    public getValidAttributes(userAttributes: { [key: string]: string }): CognitoIdentityServiceProvider.AttributeType[] {

        //Create the additional user attributes to use
        let validUserAttributes: CognitoIdentityServiceProvider.AttributeType[] = [];

        //Loop through the valid user attributes
        for (let attr in this._validUserAttributes) {

            //Check if the property is a string
            if ("string" == typeof userAttributes[attr]) {

                //Add it to the valid attributes
                validUserAttributes.push(<CognitoIdentityServiceProvider.AttributeType>{
                    Name: this._validUserAttributes[attr],
                    Value: userAttributes[attr]
                })

            }
        }

        //Return all of the valid attributes
        return validUserAttributes;

    }

    //Registers a single user
    public register(email: string, password: string, userAttributes: { [key: string]: string }): Promise<CognitoIdentityServiceProvider.SignUpResponse> {
        return new Promise((resolve, reject) => {

            //Check if we're missing the identity service provider
            if ("undefined" == typeof this._cognito) return reject(Errors.stamp(this._errors["InvalidISPException"]))

            //Create the additional user attributes to use
            let validUserAttributes: CognitoIdentityServiceProvider.AttributeType[] = this.getValidAttributes(userAttributes);

            //Create the sign up request
            let signUpRequest: CognitoIdentityServiceProvider.SignUpRequest = {
                ClientId: this._options.clientId,
                Username: email,
                Password: password,
                UserAttributes: validUserAttributes
            }

            //Execute the sign up
            this._cognito.signUp(signUpRequest, (err: AWSError | null, data: CognitoIdentityServiceProvider.SignUpResponse) => {
                if (err) return reject(Errors.awsErrorToIError(err));
                return resolve(data)
            })

        })
    }

    //Creates users from the emails provided
    public batchRegister(emails: string[]): Promise<CognitoIdentityServiceProvider.AdminCreateUserResponse[]> {
        return new Promise((resolve, reject) => {

            //Check if we've exceeded how many elements we can handle
            if (BATCH_LIMIT < emails.length) return reject(Errors.stamp(this._errors["ExceededBatchLimitException"]))

            //Prepare the promises
            let registrationPromises: Promise<CognitoIdentityServiceProvider.AdminCreateUserResponse>[] = [];

            //Loop through the emails
            for (let email of emails) {

                //Create the request
                let batchRegisterRequest: CognitoIdentityServiceProvider.AdminCreateUserRequest = {
                    UserPoolId: this._options.userPool,
                    Username: email,
                    UserAttributes: [
                        { Name: "email_verified", Value: "True" },
                        { Name: "email", Value: email }
                    ],
                    DesiredDeliveryMediums: ["EMAIL"]
                };

                //Add a promise
                registrationPromises.push(new Promise((registrationResolve, registrationReject) => {

                    //Check if we're missing the identity service provider
                    if ("undefined" == typeof this._cognito) return reject(Errors.stamp(this._errors["InvalidISPException"]))

                    //Execute the request
                    this._cognito.adminCreateUser(batchRegisterRequest, (err: AWSError | null, data: CognitoIdentityServiceProvider.AdminCreateUserResponse) => {
                        if (err) return registrationReject(err);
                        return registrationResolve(data);
                    });

                }))

            }

            //Create all the users
            Promise.all(registrationPromises)
                .then((data: CognitoIdentityServiceProvider.AdminCreateUserResponse[]) => { return resolve(data); })
                .catch((err: AWSError) => { return reject(Errors.awsErrorToIError(err)); });

        })
    }

    //Logs the user in
    public login(email: string, password: string): Promise<CognitoIdentityServiceProvider.AdminInitiateAuthResponse> {
        return new Promise((resolve, reject) => {

            //Check if we're missing the identity service provider
            if ("undefined" == typeof this._cognito) return reject(Errors.stamp(this._errors["InvalidISPException"]))

            //Create the request
            let loginRequest: CognitoIdentityServiceProvider.AdminInitiateAuthRequest = {
                AuthFlow: "ADMIN_NO_SRP_AUTH",
                ClientId: this._options.clientId,
                UserPoolId: this._options.userPool,
                AuthParameters: { USERNAME: email, PASSWORD: password }
            };

            //Execute the request
            this._cognito.adminInitiateAuth(loginRequest, (err: AWSError | null, data: CognitoIdentityServiceProvider.AdminInitiateAuthResponse) => {
                if (err) return reject(Errors.awsErrorToIError(err));
                return resolve(data)
            })

        });
    }

    //Logs the user out
    public logout(email: string): Promise<CognitoIdentityServiceProvider.AdminUserGlobalSignOutResponse> {
        return new Promise((resolve, reject) => {

            //Check if we're missing the identity service provider
            if ("undefined" == typeof this._cognito) return reject(Errors.stamp(this._errors["InvalidISPException"]))

            //Create the request
            let logoutRequest: CognitoIdentityServiceProvider.AdminUserGlobalSignOutRequest = {
                UserPoolId: this._options.userPool,
                Username: email
            }

            //Execute the request
            this._cognito.adminUserGlobalSignOut(logoutRequest, (err: AWSError | null, data: CognitoIdentityServiceProvider.AdminUserGlobalSignOutResponse) => {
                if (err) return reject(Errors.awsErrorToIError(err));
                return resolve(data)
            })
        })
    }

    //Refreshes the user tokens
    public refreshTokens(email: string, refreshToken: string, deviceKey?: string): Promise<CognitoIdentityServiceProvider.AdminInitiateAuthResponse> {
        return new Promise((resolve, reject) => {

            //Check if we're missing the identity service provider
            if ("undefined" == typeof this._cognito) return reject(Errors.stamp(this._errors["InvalidISPException"]))

            //Prepare the auth parameters
            let authParameters: CognitoIdentityServiceProvider.AuthParametersType = { USERNAME: email, REFRESH_TOKEN: refreshToken }

            //Add the device key if provided
            if ("undefined" != typeof deviceKey) authParameters["DEVICE_KEY"] = deviceKey;

            //Create the request
            let loginRequest: CognitoIdentityServiceProvider.AdminInitiateAuthRequest = {
                AuthFlow: "REFRESH_TOKEN",
                ClientId: this._options.clientId,
                UserPoolId: this._options.userPool,
                AuthParameters: authParameters
            };

            //Execute the request
            this._cognito.adminInitiateAuth(loginRequest, (err: AWSError | null, data: CognitoIdentityServiceProvider.AdminInitiateAuthResponse) => {
                if (err) return reject(Errors.awsErrorToIError(err));
                return resolve(data)
            })

        });
    }

    //Starts the password reset process
    public forgotPassword(email: string): Promise<CognitoIdentityServiceProvider.ForgotPasswordResponse> {
        return new Promise((resolve, reject) => {

            //Check if we're missing the identity service provider
            if ("undefined" == typeof this._cognito) return reject(Errors.stamp(this._errors["InvalidISPException"]))

            //Create the request
            let forgotPasswordRequest: CognitoIdentityServiceProvider.ForgotPasswordRequest = {
                ClientId: this._options.clientId,
                Username: email
            };

            //Execute the request
            this._cognito.forgotPassword(forgotPasswordRequest, (err: AWSError | null, data: CognitoIdentityServiceProvider.ForgotPasswordResponse) => {
                if (err) return reject(Errors.awsErrorToIError(err));
                return resolve(data)
            })

        });
    }

    //Starts the password reset process
    public confirmForgotPassword(email: string, password: string, confirmationCode: string): Promise<CognitoIdentityServiceProvider.ConfirmForgotPasswordResponse> {
        return new Promise((resolve, reject) => {

            //Check if we're missing the identity service provider
            if ("undefined" == typeof this._cognito) return reject(Errors.stamp(this._errors["InvalidISPException"]))

            //Create the request
            let confirmForgotPasswordRequest: CognitoIdentityServiceProvider.ConfirmForgotPasswordRequest = {
                ClientId: this._options.clientId,
                Username: email,
                Password: password,
                ConfirmationCode: confirmationCode
            };

            //Execute the request
            this._cognito.confirmForgotPassword(confirmForgotPasswordRequest, (err: AWSError | null, data: CognitoIdentityServiceProvider.ConfirmForgotPasswordResponse) => {
                if (err) return reject(Errors.awsErrorToIError(err));
                return resolve(data)
            })

        });
    }

    //Changes the user's password
    public changePassword(accessToken: string, oldPassword: string, newPassword: string): Promise<CognitoIdentityServiceProvider.ChangePasswordResponse> {
        return new Promise((resolve, reject) => {

            //Check if we're missing the identity service provider
            if ("undefined" == typeof this._cognito) return reject(Errors.stamp(this._errors["InvalidISPException"]))

            //Create the request
            let passwordChangeRequest: CognitoIdentityServiceProvider.ChangePasswordRequest = {
                AccessToken: accessToken,
                PreviousPassword: oldPassword,
                ProposedPassword: newPassword
            };

            //Execute the request
            this._cognito.changePassword(passwordChangeRequest, (err: AWSError | null, data: CognitoIdentityServiceProvider.ChangePasswordResponse) => {
                if (err) return reject(Errors.awsErrorToIError(err));
                return resolve(data)
            })

        });
    }


    //Allows the user to respond to authorization challenges
    public respondToAuthChallenge(email: string, challegeName: string, session: string, challengeResponses: CognitoAuthChallengeResponses, userAttributes: { [key: string]: string }): Promise<CognitoIdentityServiceProvider.AdminRespondToAuthChallengeResponse> {
        return new Promise((resolve, reject) => {

            //Check if we're missing the identity service provider
            if ("undefined" == typeof this._cognito) return reject(Errors.stamp(this._errors["InvalidISPException"]))

            //Change the challenge name to upercase
            challegeName = challegeName.toUpperCase();

            //Create the challenge response
            let challengeResponse: CognitoIdentityServiceProvider.ChallengeResponsesType = { USERNAME: email };
            for (let key in challengeResponses) {
                if ("undefined" != typeof challengeResponses[key])
                    challengeResponse[key] = <string>challengeResponses[key]
            }

            //Loop through the valid user attributes
            for (let attr in this._validUserAttributes) {

                //Check if the property is a string
                if ("string" == typeof userAttributes[attr]) {

                    //Add the user attribute to the challenge response
                    challengeResponse["userAttributes." + this._validUserAttributes[attr]] = userAttributes[attr];
                }
            }

            //Create the request
            let authChallengeRequest: CognitoIdentityServiceProvider.AdminRespondToAuthChallengeRequest = {
                ChallengeName: challegeName,
                ClientId: this._options.clientId,
                UserPoolId: this._options.userPool,
                ChallengeResponses: challengeResponse,
                Session: session
            };

            //Execute the request
            this._cognito.adminRespondToAuthChallenge(authChallengeRequest, (err: AWSError | null, data: CognitoIdentityServiceProvider.AdminRespondToAuthChallengeResponse) => {
                if (err) return reject(Errors.awsErrorToIError(err));
                return resolve(data)
            })

        });
    }

}