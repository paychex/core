import createStore from './htmlStore';

export default function localStore(config = {}, provider = localStorage) {

    return createStore(config, provider);

}
