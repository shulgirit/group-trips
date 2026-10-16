// Web Crypto exists in every runtime this package runs in (browsers, Node,
// Convex, React Native via expo-crypto's polyfill) — declare only what we use
// instead of pulling in the DOM lib.
declare var crypto: {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
};
