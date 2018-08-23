import { CognitoIdentityServiceProvider } from "aws-sdk"
import { AWSCallback } from "./AWSCallback";

export interface IdentityServiceProvider {
    createUserPool: (params: CognitoIdentityServiceProvider.CreateUserPoolRequest, callback: AWSCallback) => any;
    createUserPoolClient: (params: CognitoIdentityServiceProvider.CreateUserPoolClientRequest, callback: AWSCallback) => any;
    createUserPoolDomain: (params: CognitoIdentityServiceProvider.CreateUserPoolDomainRequest, callback: AWSCallback) => any;
    signUp: (params: CognitoIdentityServiceProvider.SignUpRequest, callback: AWSCallback) => any;
    confirmSignUp: (params: CognitoIdentityServiceProvider.ConfirmSignUpRequest, callback: AWSCallback) => any;
    adminCreateUser: (params: CognitoIdentityServiceProvider.AdminCreateUserRequest, callback: AWSCallback) => any;
    adminInitiateAuth: (params: CognitoIdentityServiceProvider.AdminInitiateAuthRequest, callback: AWSCallback) => any;
    adminUserGlobalSignOut: (params: CognitoIdentityServiceProvider.AdminUserGlobalSignOutRequest, callback: AWSCallback) => any;
    forgotPassword: (params: CognitoIdentityServiceProvider.ForgotPasswordRequest, callback: AWSCallback) => any;
    confirmForgotPassword: (params: CognitoIdentityServiceProvider.ConfirmForgotPasswordRequest, callback: AWSCallback) => any;
    changePassword: (params: CognitoIdentityServiceProvider.ChangePasswordRequest, callback: AWSCallback) => any;
    adminRespondToAuthChallenge: (params: CognitoIdentityServiceProvider.AdminRespondToAuthChallengeRequest, callback: AWSCallback) => any;
}