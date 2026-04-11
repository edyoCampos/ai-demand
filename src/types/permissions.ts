export type PermissionMode = 'default' | 'bypass' | 'auto';

export type PermissionBehavior = 'allow' | 'deny';

export type PermissionResult = 
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; reason?: string };

export type ToolPermissionContext = {
  mode: PermissionMode;
  additionalWorkingDirectories: Map<string, unknown>;
  alwaysAllowRules: Record<string, unknown>;
  alwaysDenyRules: Record<string, unknown>;
  alwaysAskRules: Record<string, unknown>;
  isBypassPermissionsModeAvailable: boolean;
};

export function getEmptyToolPermissionContext(): ToolPermissionContext {
  return {
    mode: 'default',
    additionalWorkingDirectories: new Map(),
    alwaysAllowRules: {},
    alwaysDenyRules: {},
    alwaysAskRules: {},
    isBypassPermissionsModeAvailable: false,
  };
}
