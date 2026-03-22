export type MessageParams = Record<string, string | number>;

type Join<K extends string, P extends string> = `${K}.${P}`;

export type MessageSchema<T> = {
  [K in keyof T]:
    T[K] extends string
      ? string
      : T[K] extends Record<string, unknown>
        ? MessageSchema<T[K]>
        : never;
};

export type MessageKeyOf<T> = {
  [K in keyof T & string]:
    T[K] extends string
      ? K
      : T[K] extends Record<string, unknown>
        ? Join<K, MessageKeyOf<T[K]>>
        : never;
}[keyof T & string];
