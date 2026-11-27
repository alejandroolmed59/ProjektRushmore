/**
 * An expected failure caused by what the user asked for (not enough money, a
 * closed or unknown forecast, a bad amount). Handlers show the message to the
 * user and don't log it as a fault.
 */
export class UserError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
        this.name = 'UserError'
    }
}
