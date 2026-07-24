import {
  ENDPOINTS,
  MODEL_FIELDS,
  RESOURCE_SPECS,
} from "./generated/catalog.js";

export interface CatalogModule {
  model_names: readonly string[];
  resource_specs: readonly (typeof RESOURCE_SPECS)[number][];
}

function buildModules(): Readonly<Record<string, CatalogModule>> {
  const modules: Record<string, { model_names: string[]; resource_specs: (typeof RESOURCE_SPECS)[number][] }> = {};
  for (const spec of RESOURCE_SPECS) {
    const module = modules[spec.module] ??= { model_names: [], resource_specs: [] };
    module.resource_specs.push(spec);
    if (!module.model_names.includes(spec.model_name)) module.model_names.push(spec.model_name);
  }
  return modules;
}

export const MODULES = buildModules();

export type EndpointConfidence =
  | "documented"
  | "prior_art"
  | "field_discovered"
  | "live_help_catalog";

export const ENDPOINT_CONFIDENCE_VALUES = [
  "documented",
  "prior_art",
  "field_discovered",
  "live_help_catalog",
] as const satisfies readonly EndpointConfidence[];

const CONFIDENCE_SET = new Set<string>(ENDPOINT_CONFIDENCE_VALUES);

export interface EndpointSpecInput {
  method: string;
  path: string;
  model?: string | null;
  confidence: EndpointConfidence;
  source: string;
}

export class EndpointSpec {
  readonly method: string;
  readonly path: string;
  readonly model: string | null;
  readonly confidence: EndpointConfidence;
  readonly source: string;

  constructor(input: EndpointSpecInput);
  constructor(
    method: string,
    path: string,
    model: string | null,
    confidence: EndpointConfidence,
    source: string,
  );
  constructor(
    inputOrMethod: EndpointSpecInput | string,
    path?: string,
    model?: string | null,
    confidence?: EndpointConfidence,
    source?: string,
  ) {
    const input: EndpointSpecInput =
      typeof inputOrMethod === "object"
        ? inputOrMethod
        : {
            method: inputOrMethod,
            path: path ?? "",
            model: model ?? null,
            confidence: confidence as EndpointConfidence,
            source: source ?? "",
          };
    if (!CONFIDENCE_SET.has(input.confidence)) {
      throw new TypeError(
        `EndpointSpec confidence must be one of: ${ENDPOINT_CONFIDENCE_VALUES.join(", ")}`,
      );
    }
    this.method = input.method.toUpperCase();
    this.path = input.path;
    this.model = input.model ?? null;
    this.confidence = input.confidence;
    this.source = input.source;
  }

  toObject(): EndpointSpecInput & { model: string | null } {
    return {
      method: this.method,
      path: this.path,
      model: this.model,
      confidence: this.confidence,
      source: this.source,
    };
  }

  toArray(): EndpointSpecInput & { model: string | null } {
    return this.toObject();
  }
}

export class EndpointRegistry implements Iterable<EndpointSpec> {
  readonly endpoints: readonly EndpointSpec[];

  constructor(endpoints: Iterable<EndpointSpec | EndpointSpecInput>) {
    this.endpoints = [...endpoints].map((endpoint) =>
      endpoint instanceof EndpointSpec ? endpoint : new EndpointSpec(endpoint),
    );
  }

  static default(): EndpointRegistry {
    return new EndpointRegistry(
      ENDPOINTS.map((endpoint) =>
        new EndpointSpec({
          method: endpoint.method,
          path: endpoint.path,
          model: endpoint.model,
          confidence: endpoint.confidence,
          source: endpoint.source,
        }),
      ),
    );
  }

  coverageReport(): ReturnType<EndpointSpec["toObject"]>[] {
    return this.endpoints.map((endpoint) => endpoint.toObject());
  }

  coverage_report(): ReturnType<EndpointSpec["toObject"]>[] {
    return this.coverageReport();
  }

  [Symbol.iterator](): Iterator<EndpointSpec> {
    return this.endpoints[Symbol.iterator]();
  }
}

export class Catalog {
  static data() {
    return {
      modules: MODULES,
      resource_specs: RESOURCE_SPECS,
      model_fields: MODEL_FIELDS,
      endpoints: ENDPOINTS,
    } as const;
  }

  static resourceSpecs() {
    return RESOURCE_SPECS;
  }

  static modules() {
    return MODULES;
  }

  static resource_specs() {
    return Catalog.resourceSpecs();
  }

  static modelFields() {
    return MODEL_FIELDS;
  }

  static model_fields() {
    return Catalog.modelFields();
  }

  static endpoints() {
    return ENDPOINTS;
  }
}

export { ENDPOINTS, MODEL_FIELDS, RESOURCE_SPECS };
