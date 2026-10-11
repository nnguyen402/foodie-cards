// These two ship without types here; the component test only needs a small slice of each.
declare module 'react-dom/server' {
  export function renderToStaticMarkup(element: unknown): string;
}
declare module 'react-native-web';
