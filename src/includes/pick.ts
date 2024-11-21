type PickOptions = Partial<{
  leaveUndefined: boolean;
}>;

export function pick<O extends Partial<Record<K, any>>, K extends keyof O = keyof O>(
  obj: O,
  keys: K[],
  options: PickOptions = {},
): Pick<O, K> {
  let entries = keys.map((key) => [key, obj[key]] as const);

  if (!options.leaveUndefined) {
    entries = entries.filter((entry): entry is [K, O[K]] => entry[1] !== undefined);
  }

  // @ts-ignore keys of Object.fromEntries is not typed
  return Object.fromEntries(entries);
}
