import { AWSError } from "aws-sdk";
export declare type AWSCallback = ((error: AWSError | null, data: any) => void) | undefined;
