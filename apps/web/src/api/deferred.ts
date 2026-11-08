import type { AccountApi, AccountApiOptions } from "./account";
import type { HomeApi } from "./home";
import type { ContentApi } from "./content";
import type { SourceQualityApi } from "./sourceQuality";

type AsyncMethods<T> = { [K in keyof T]: (...args: never[]) => Promise<unknown> };

export function deferApi<T extends AsyncMethods<T>>(load: () => Promise<T>): T {
  let instance: Promise<T> | undefined;
  return new Proxy({} as T, {
    get:
      (_target, method) =>
      (...args: unknown[]) => {
        instance ??= load().catch((error) => {
          instance = undefined;
          throw error;
        });
        return instance.then((api) => Reflect.apply(Reflect.get(api, method), api, args));
      }
  });
}

export const homeApi = deferApi<HomeApi>(() => import("./home").then((module) => module.homeApi));
export const contentApi = deferApi<ContentApi>(() => import("./content").then((module) => module.contentApi));
export const sourceQualityApi = deferApi<SourceQualityApi>(() => import("./sourceQuality").then((module) => module.sourceQualityApi));

export function createDeferredAccountApi(options: AccountApiOptions) {
  return deferApi<AccountApi>(() => import("./account").then((module) => module.createAccountApi(options)));
}
