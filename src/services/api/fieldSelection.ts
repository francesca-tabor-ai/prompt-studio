export interface FieldSelectionOptions {
  fields?: string[];
  include?: string[];
  exclude?: string[];
}

class FieldSelectionService {
  private static instance: FieldSelectionService;

  private constructor() {}

  static getInstance(): FieldSelectionService {
    if (!FieldSelectionService.instance) {
      FieldSelectionService.instance = new FieldSelectionService();
    }
    return FieldSelectionService.instance;
  }

  parseFields(query: any): FieldSelectionOptions {
    const options: FieldSelectionOptions = {};

    if (query.fields) {
      options.fields = query.fields.split(',').map((f: string) => f.trim());
    }

    if (query.include) {
      options.include = query.include.split(',').map((f: string) => f.trim());
    }

    if (query.exclude) {
      options.exclude = query.exclude.split(',').map((f: string) => f.trim());
    }

    return options;
  }

  selectFields<T>(data: T, options: FieldSelectionOptions): Partial<T> {
    if (!options.fields && !options.include && !options.exclude) {
      return data;
    }

    const result: any = {};

    if (options.fields && options.fields.length > 0) {
      for (const field of options.fields) {
        if (this.hasNestedField(data, field)) {
          this.setNestedField(result, field, this.getNestedField(data, field));
        }
      }
      return result;
    }

    for (const key in data) {
      result[key] = data[key];
    }

    if (options.exclude && options.exclude.length > 0) {
      for (const field of options.exclude) {
        this.deleteNestedField(result, field);
      }
    }

    if (options.include && options.include.length > 0) {
      const filteredResult: any = {};
      for (const field of options.include) {
        if (this.hasNestedField(result, field)) {
          this.setNestedField(
            filteredResult,
            field,
            this.getNestedField(result, field)
          );
        }
      }
      return filteredResult;
    }

    return result;
  }

  selectFieldsArray<T>(
    data: T[],
    options: FieldSelectionOptions
  ): Partial<T>[] {
    return data.map((item) => this.selectFields(item, options));
  }

  buildSupabaseSelect(options: FieldSelectionOptions): string {
    if (options.fields && options.fields.length > 0) {
      return options.fields.join(',');
    }

    if (options.include && options.include.length > 0) {
      return options.include.join(',');
    }

    return '*';
  }

  private hasNestedField(obj: any, path: string): boolean {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return false;
      }
      current = current[key];
    }

    return true;
  }

  private getNestedField(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  private setNestedField(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  private deleteNestedField(obj: any, path: string): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        return;
      }
      current = current[key];
    }

    delete current[keys[keys.length - 1]];
  }

  validateFields(fields: string[], allowedFields: string[]): boolean {
    for (const field of fields) {
      const baseField = field.split('.')[0];
      if (!allowedFields.includes(baseField)) {
        return false;
      }
    }
    return true;
  }

  estimatePayloadReduction(
    options: FieldSelectionOptions,
    totalFields: number
  ): number {
    if (options.fields) {
      return ((totalFields - options.fields.length) / totalFields) * 100;
    }

    if (options.exclude) {
      return (options.exclude.length / totalFields) * 100;
    }

    if (options.include) {
      return ((totalFields - options.include.length) / totalFields) * 100;
    }

    return 0;
  }
}

export const fieldSelectionService = FieldSelectionService.getInstance();
