import { CognitoIdentityServiceProvider } from "aws-sdk";
import { CognitoWrapperOptions, CognitoAuthChallengeResponses, IdentityServiceProvider } from "../interfaces/CognitoWrapper.barrel";
export declare class CognitoWrapper {
    private _options;
    private _cognito;
    private _validUserAttributes;
    private _errors;
    constructor(options: CognitoWrapperOptions);
    setIdentityServiceProvider(isp: IdentityServiceProvider): CognitoWrapper;
    setAcceptedUserAttributes(attributes: {
        [key: string]: string;
    }): CognitoWrapper;
    getValidAttributes(userAttributes: {
        [key: string]: string;
    }): CognitoIdentityServiceProvider.AttributeType[];
    register(email: string, password: string, userAttributes: {
        [key: string]: string;
    }): Promise<CognitoIdentityServiceProvider.SignUpResponse>;
    batchRegister(emails: string[]): Promise<CognitoIdentityServiceProvider.AdminCreateUserResponse[]>;
    login(email: string, password: string): Promise<CognitoIdentityServiceProvider.AdminInitiateAuthResponse>;
    logout(email: string): Promise<CognitoIdentityServiceProvider.AdminUserGlobalSignOutResponse>;
    refreshTokens(email: string, refreshToken: string, deviceKey?: string): Promise<CognitoIdentityServiceProvider.AdminInitiateAuthResponse>;
    forgotPassword(email: string): Promise<CognitoIdentityServiceProvider.ForgotPasswordResponse>;
    confirmForgotPassword(email: string, password: string, confirmationCode: string): Promise<CognitoIdentityServiceProvider.ConfirmForgotPasswordResponse>;
    changePassword(accessToken: string, oldPassword: string, newPassword: string): Promise<CognitoIdentityServiceProvider.ChangePasswordResponse>;
    respondToAuthChallenge(email: string, challegeName: string, session: string, challengeResponses: CognitoAuthChallengeResponses, userAttributes: {
        [key: string]: string;
    }): Promise<CognitoIdentityServiceProvider.AdminRespondToAuthChallengeResponse>;
}
