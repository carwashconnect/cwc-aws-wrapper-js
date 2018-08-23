import { AWSError } from "aws-sdk"
export type AWSCallback = ((error: AWSError, data: any) => void) | undefined;