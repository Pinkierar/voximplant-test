export function pick<O extends Partial<Record<K, any>>, K extends keyof O = keyof O>(obj: O, keys: K[]): Pick<O, K> {
  // @ts-ignore keys of Object.fromEntries is not typed
  return Object.fromEntries(keys.map((key) => [key, obj[key]]));
}
