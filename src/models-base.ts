export type ModelData = Record<string, unknown>;

/**
 * Permissive base model matching the Python/PHP SDK behavior. Known WAPI fields
 * are declared by generated subclasses; newly introduced fields are retained.
 */
export class RMBaseModel {
  [key: string]: unknown;

  declare ApiUri?: string | null;
  declare APIURI?: string | null;
  declare ID?: number | null;
  declare Id?: number | null;
  declare CreateDate?: string | null;
  declare DateCreated?: string | null;
  declare UpdateDate?: string | null;
  declare DateUpdated?: string | null;

  constructor(data: ModelData = {}) {
    Object.assign(this, data);
  }

  static from<T extends RMBaseModel>(
    this: new (data?: ModelData) => T,
    data: ModelData | null | undefined,
  ): T {
    return new this(data ?? {});
  }

  toArray(): ModelData {
    return { ...this };
  }

  to_array(): ModelData {
    return this.toArray();
  }

  modelDump(): ModelData {
    return this.toArray();
  }

  model_dump(): ModelData {
    return this.toArray();
  }

  toJSON(): ModelData {
    return this.toArray();
  }
}

export interface ModelConstructor<T extends RMBaseModel = RMBaseModel> {
  new (data?: ModelData): T;
}
