export class CognitoAuthChallengeResponses {
    USERNAME?: string;
    SECRET_HASH?: string;
    SMS_MFA_CODE?: string;
    PASSWORD_CLAIM_SIGNATURE?: string;
    PASSWORD_CLAIM_SECRET_BLOCK?: string;
    TIMESTAMP?: string;
    PASSWORD?: string;
    NEW_PASSWORD?: string;
    [key: string]: string | undefined;
}