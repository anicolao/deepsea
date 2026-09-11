import { expect as baseExpect } from '@playwright/test';

let assertionCount = 0;
export const assertionsPerformed = () => assertionCount;

// Count matcher calls, including negation, so an empty callback cannot pass as
// a semantic check. Workers execute scenarios serially under the config contract.
function counted(matchers: object): object {
  return new Proxy(matchers, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value === 'function') return (...args: unknown[]) => {
        assertionCount++;
        return Reflect.apply(value, target, args);
      };
      return value && typeof value === 'object' ? counted(value) : value;
    }
  });
}

export const expect: typeof baseExpect = new Proxy(baseExpect, {
  apply(target, receiver, args) {
    return counted(Reflect.apply(target, receiver, args));
  }
});
