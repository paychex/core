export function spy(name = 'spy') {

    let value, err,
        args = [],
        callCount = 0;

    return Object.defineProperties((...params) => {
        args = params;
        callCount++;
        if (err) throw err;
        return value;
    }, {
        name: { get: () => name },
        args: { get: () => args },
        called: { get: () => callCount > 0 },
        callCount: { get: () => callCount },
        reset: {
            configurable: false,
            writable: false,
            value() {
                value = err = undefined;
                args = [];
                callCount = 0;
            }
        },
        throws: {
            configurable: false,
            writable: false,
            value(e) {
                err = e;
                return this;
            }
        },
        returns: {
            configurable: false,
            writable: false,
            value(v) {
                value = v;
                err = null;
                return this;
            }
        }
    });

};
