import { ValidationLimits } from "@carwashconnect/cwc-core-js";
export interface DynamoWrapperTable {
    name: string;
    tableName: {
        [key: string]: string;
    };
    logTableName?: {
        [key: string]: string;
    };
    columns: {
        id: IDColumnLimits;
        [key: string]: TableColumnLimits;
    };
}
interface TableColumnLimits extends ValidationLimits {
    name: string;
    key?: boolean;
}
interface IDColumnLimits extends TableColumnLimits {
    key: boolean;
    required: true;
    prefix: string;
}
export {};
