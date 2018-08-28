import { AWSError } from "aws-sdk"
export type AWSCallback = ((error: AWSError | null, data: any) => void) | undefined;