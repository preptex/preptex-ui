import type { OperationFailure, PrepTexErrorCode } from '@preptex/core';

export type ProcessingError =
  | {
      readonly kind: 'operation';
      readonly message: string;
      readonly code: PrepTexErrorCode;
      readonly failure: OperationFailure;
    }
  | { readonly kind: 'core'; readonly message: string; readonly code: PrepTexErrorCode }
  | { readonly kind: 'unexpected'; readonly message: string };
