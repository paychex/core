// import QS from 'query-string';

// import PayxContext from './PayxContext';
// import PayxContainer from './PayxContainer';

// let lastHash = '';
// let attached = false;

// const PREFIX = '#!';
// const PARSE_OPTS = { arrayFormat: 'bracket'};

// const rxValidHash = /./; // TODO
// const rxParseRoute = /(.+?)\:\/\/([^\?]*)\??(.*)/;
// const routeData = {};

// function onHashChanged() {
//     const hash = document.location.hash.substring(PREFIX.length);
//     if (hash === lastHash) return;
//     if (hash && !rxValidHash.test(hash))
//         return window.history.replaceState(
//             null,
//             document.title,
//             document.location.pathname + document.location.search
//         );
//     populateRouteData();
//     synchronizeAll();
//     lastHash = hash;
// }

// function populateRouteData() {
//     document.location.hash.substring(PREFIX.length)
//         .split('||')
//         .filter(Boolean)
//         .forEach(route => {
//             const [_, id, elements, data] = rxParseRoute.exec(route);
//             const children = elements.split(',').filter(Boolean);
//             const obj = QS.parse(data, PARSE_OPTS);
//             routeData[id] = {
//                 data: obj,
//                 elements: children
//             };
//         });
// }

// function updateHashString() {
//     document.location.hash = Object.keys(routeData)
//         .sort()
//         .map(key => [key, routeData[key]])
//         .reduce((hash, [containerId, route], index) => {
//             const sep = (index > 0 && hash !== PREFIX) ? '||' : '';
//             const tags = (route.elements || []).join(',').toLowerCase();
//             const qs = route.data && QS.stringify(route.data, PARSE_OPTS) || '';
//             return `${hash}${sep}${containerId}://${tags}${qs ? '?' + qs : ''}`;
//         }, PREFIX);
// }

// function synchronizeAll() {
//     Object.keys(routeData)
//         .map(containerId => [PayxContainer.getById(containerId), routeData[containerId]])
//         .filter(params => params.every(Boolean))
//         .forEach(params => synchronize(...params));
// }

// function synchronize(container, route) {
//     route.data && Object.keys(route.data).forEach(key =>
//         PayxContext.set(container, key, route.data[key]));
//     if (!route.elements) return Promise.resolve();
//     const children = Array.from(container.children)
//         .filter(child => !child.hasAttribute('no-route'));
//     const toRemove = children.slice(route.elements.length);
//     return route.elements.reduce((promise, element, i) => {
//         const existing = children[i];
//         return promise.then(() => {
//             if (!existing)
//                 return container.add(element);
//             if (existing.nodeName.toLowerCase() !== element)
//                 return container.remove(existing).then(() => container.add(element));
//         });
//     }, Promise.all(toRemove.map(child => container.remove(child))));
// }

// function attach(container) {

//     if (!('staticId' in container))
//         throw new Error('Please specify a static-id for your <payx-container> element.');

//     if (!attached) {
//         attached = true;
//         window.addEventListener('hashchange', onHashChanged);
//         populateRouteData();
//     }

//     function updateRouteChildren() {
//         const route = routeData[container.staticId] || {};
//         route.elements = Array.from(container.children)
//             .filter(child => !child.hasAttribute('no-route'))
//             .map(child => child.nodeName);
//         routeData[container.staticId] = route;
//         updateHashString();
//     }

//     function updateRouteQuerystring(data) {
//         const route = routeData[container.staticId] || {};
//         route.data = data;
//         routeData[container.staticId] = route;
//         updateHashString();
//     }

//     const observer = new MutationObserver(updateRouteChildren);
//     const sub = PayxContext.get(container).subscribe(updateRouteQuerystring);

//     if (container.staticId in routeData) {
//         synchronize(container, routeData[container.staticId])
//             .then(() => observer.observe(container, { childList: true }));
//     } else {
//         updateRouteChildren();
//         updateRouteQuerystring();
//         observer.observe(container, { childList: true });
//     }

//     container.setAttribute('route-container', '');

//     return () => {
//         sub.unsubscribe();
//         observer.disconnect();
//         delete routeData[container.stackId];
//         updateHashString();
//     };

// }

// export default { attach };