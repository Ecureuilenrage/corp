import type {
  ExtensionRegistrationMetadata,
  ExtensionRegistrationSchemaVersion,
} from "./extension-registration";

export interface RegisteredCapabilityLocalRefs {
  rootDir: string;
  entrypoint?: string;
  references: string[];
  metadataFile?: string;
  scripts: string[];
}

export interface RegisteredCapabilityMcpBinding {
  serverName: string;
  toolName: string;
}

export interface RegisteredCapability {
  capabilityId: string;
  registrationId: string;
  schemaVersion: ExtensionRegistrationSchemaVersion;
  provider: "local" | "mcp";
  displayName: string;
  version: string;
  permissions: string[];
  constraints: string[];
  approvalSensitive: boolean;
  requiredEnvNames: string[];
  metadata: ExtensionRegistrationMetadata;
  localRefs: RegisteredCapabilityLocalRefs;
  mcp: RegisteredCapabilityMcpBinding | null;
  registeredAt: string;
  sourceManifestPath: string;
}

export interface CapabilityInvocationDetails {
  capabilityId: RegisteredCapability["capabilityId"];
  registrationId: RegisteredCapability["registrationId"];
  provider: RegisteredCapability["provider"];
  approvalSensitive: RegisteredCapability["approvalSensitive"];
  permissions: RegisteredCapability["permissions"];
  constraints: RegisteredCapability["constraints"];
  requiredEnvNames: RegisteredCapability["requiredEnvNames"];
}
