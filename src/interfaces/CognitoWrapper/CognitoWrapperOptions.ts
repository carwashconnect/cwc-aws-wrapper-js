export interface CognitoWrapperOptions {
    region?: string;
    userPool: string;
    clientId: string;
    secretHash?: string;
}