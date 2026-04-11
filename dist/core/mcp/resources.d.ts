export interface Resource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}
export interface ResourceContent {
    uri: string;
    text?: string;
    blob?: string;
}
export interface ResourceProvider {
    listResources(): Promise<Resource[]>;
    readResource(uri: string): Promise<ResourceContent>;
}
//# sourceMappingURL=resources.d.ts.map