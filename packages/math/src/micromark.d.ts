import type { Extension } from 'micromark-util-types'

export interface MathSyntaxOptions {
  singleDollarTextMath?: boolean | null
}

export declare function math(options?: MathSyntaxOptions | null): Extension
