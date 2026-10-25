/** Escapes a string for literal use inside a RegExp (e.g. building "<prefix>_CLS(\d+)" matchers). */
export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
