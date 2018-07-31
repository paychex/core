import QS from 'query-string';

const rxToken = /:([^\/]+)/g;

const replacer = params => (_, key) => {
    const value = params[key];
    return (delete params[key]) ? value : '';
}

export default function tokenize(url = '', params = {}) {
    const out = url.replace(rxToken, replacer(params));
    const sep = out.includes('?') ? '' : '?'
    return out + sep + QS.stringify(params);
}
