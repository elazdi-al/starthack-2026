"use client";

import * as React from "react";

const subscribe = () => () => {};

export function useHydrated() {
  return React.useSyncExternalStore(subscribe, () => true, () => false);
}
