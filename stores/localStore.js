import createStore from './htmlStore';

export default function localStore(provider = localStorage) {

    return createStore(provider);

}
