export function spy() {
    let value, err;
    const fn = (...args) => {
        fn.args = args;
        fn.callCount++;
        fn.called = true;
        if (err) throw err;
        return value;
    };
    fn.args = [];
    fn.callCount = 0;
    fn.called = false;
    fn.throws = (e) => {
        err = e;
        return fn;
    };
    fn.returns = (v) => {
        value = v;
        err = null;
        return fn;
    };
    return fn;
};
