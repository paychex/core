export function spy(name = 'spy') {

    let value, err,
        args = [],
        callCount = 0,
        called = false;

    return Object.defineProperties((...params) => {
        args = params;
        callCount++;
        called = true;
        if (err) throw err;
        return value;
    }, {
        name: { get: () => name },
        args: { get: () => args },
        called: { get: () => called },
        callCount: { get: () => callCount },
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
