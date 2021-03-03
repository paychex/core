/**
 * @class
 * @global
 * @hideconstructor
 */
export class InvocationData extends Array {

    /**
     * The invocation context.
     *
     * @type {*}
     * @memberof InvocationData#
     */
    [0] = null

    /**
     * The arguments passed to this invocation.
     *
     * @type {Array.<*>}
     * @memberof InvocationData#
     */
    [1] = []

}
