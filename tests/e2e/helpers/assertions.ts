import { expect as baseExpect } from '@playwright/test';
import { AsyncLocalStorage } from 'node:async_hooks';
const scopes = new AsyncLocalStorage<{count:number}>();
export async function assertionScope(callback: () => Promise<unknown>) {
  const scope = {count:0}; await scopes.run(scope,callback); return scope.count;
}

let assertionCount = 0;
export const assertionsPerformed = () => assertionCount;

// Count matcher calls, including negation, so an empty callback cannot pass as
// a semantic check. Each check has its own asynchronous scope.
function counted(matchers: object): object {
  return new Proxy(matchers, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value === 'function') return (...args: unknown[]) => {
        assertionCount++;
        const scope = scopes.getStore(); if (scope) scope.count++;
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
