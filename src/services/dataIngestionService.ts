import { supabase } from '../lib/supabase';

export interface EmployeeRecord {
  full_name: string;
  job_title?: string;
  team?: string;
  department?: string;
  email?: string;
  phone?: string;
  location?: string;
}

export interface ParsedData {
  records: EmployeeRecord[];
  errors: IngestionError[];
  duplicates: EmployeeRecord[];
  totalRecords: number;
  validRecords: number;
  preview: EmployeeRecord[];
}

export interface IngestionError {
  row_number: number;
  error_type: 'validation' | 'parsing' | 'duplicate' | 'other';
  error_message: string;
  raw_data: any;
}

export interface IngestionJob {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  source_type: 'csv' | 'text' | 'linkedin';
  total_records: number;
  processed_records: number;
  failed_records: number;
  duplicate_records: number;
  error_report: IngestionError[];
  created_at: string;
  completed_at?: string;
}

const FIELD_MAPPINGS = {
  full_name: ['full name', 'name', 'employee name', 'full_name', 'fullname', 'employee'],
  job_title: ['job title', 'title', 'position', 'role', 'job_title', 'jobtitle'],
  team: ['team', 'team name', 'team_name', 'group'],
  department: ['department', 'dept', 'division', 'department_name'],
  email: ['email', 'email address', 'e-mail', 'mail'],
  phone: ['phone', 'phone number', 'telephone', 'mobile', 'contact'],
  location: ['location', 'office', 'city', 'office location'],
};

export const dataIngestionService = {
  normalizeText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  },

  detectFieldMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};

    headers.forEach((header) => {
      const normalizedHeader = header.toLowerCase().trim();

      for (const [field, aliases] of Object.entries(FIELD_MAPPINGS)) {
        if (aliases.includes(normalizedHeader)) {
          mapping[header] = field;
          break;
        }
      }
    });

    return mapping;
  },

  parseCSV(csvText: string): ParsedData {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return {
        records: [],
        errors: [{ row_number: 0, error_type: 'parsing', error_message: 'CSV must have at least a header row and one data row', raw_data: csvText }],
        duplicates: [],
        totalRecords: 0,
        validRecords: 0,
        preview: [],
      };
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const fieldMapping = this.detectFieldMapping(headers);

    const records: EmployeeRecord[] = [];
    const errors: IngestionError[] = [];
    const seenKeys = new Set<string>();
    const duplicates: EmployeeRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line);

        if (values.length !== headers.length) {
          errors.push({
            row_number: i + 1,
            error_type: 'parsing',
            error_message: `Column count mismatch. Expected ${headers.length}, got ${values.length}`,
            raw_data: line,
          });
          continue;
        }

        const record: any = {};
        headers.forEach((header, idx) => {
          const field = fieldMapping[header];
          if (field) {
            record[field] = this.normalizeText(values[idx]);
          }
        });

        const validationError = this.validateRecord(record, i + 1);
        if (validationError) {
          errors.push(validationError);
          continue;
        }

        const duplicateKey = `${record.full_name?.toLowerCase()}:${record.email?.toLowerCase() || ''}`;
        if (seenKeys.has(duplicateKey)) {
          duplicates.push(record);
          errors.push({
            row_number: i + 1,
            error_type: 'duplicate',
            error_message: 'Duplicate employee record detected',
            raw_data: record,
          });
          continue;
        }

        seenKeys.add(duplicateKey);
        records.push(record);
      } catch (error) {
        errors.push({
          row_number: i + 1,
          error_type: 'parsing',
          error_message: error instanceof Error ? error.message : 'Unknown parsing error',
          raw_data: line,
        });
      }
    }

    return {
      records,
      errors,
      duplicates,
      totalRecords: lines.length - 1,
      validRecords: records.length,
      preview: records.slice(0, 10),
    };
  },

  parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim().replace(/^["']|["']$/g, ''));
    return values;
  },

  parseTextData(text: string): ParsedData {
    const lines = text.trim().split('\n').filter((line) => line.trim());
    const records: EmployeeRecord[] = [];
    const errors: IngestionError[] = [];
    const seenKeys = new Set<string>();
    const duplicates: EmployeeRecord[] = [];

    lines.forEach((line, idx) => {
      try {
        const parts = line.split(/[,|\t]/).map((p) => this.normalizeText(p));

        const record: EmployeeRecord = {
          full_name: parts[0] || '',
          job_title: parts[1],
          team: parts[2],
          department: parts[3],
          email: parts[4],
        };

        const validationError = this.validateRecord(record, idx + 1);
        if (validationError) {
          errors.push(validationError);
          return;
        }

        const duplicateKey = `${record.full_name.toLowerCase()}:${record.email?.toLowerCase() || ''}`;
        if (seenKeys.has(duplicateKey)) {
          duplicates.push(record);
          errors.push({
            row_number: idx + 1,
            error_type: 'duplicate',
            error_message: 'Duplicate employee record detected',
            raw_data: record,
          });
          return;
        }

        seenKeys.add(duplicateKey);
        records.push(record);
      } catch (error) {
        errors.push({
          row_number: idx + 1,
          error_type: 'parsing',
          error_message: error instanceof Error ? error.message : 'Unknown parsing error',
          raw_data: line,
        });
      }
    });

    return {
      records,
      errors,
      duplicates,
      totalRecords: lines.length,
      validRecords: records.length,
      preview: records.slice(0, 10),
    };
  },

  parseLinkedInData(text: string): ParsedData {
    const lines = text.trim().split('\n').filter((line) => line.trim());
    const records: EmployeeRecord[] = [];
    const errors: IngestionError[] = [];
    const seenKeys = new Set<string>();
    const duplicates: EmployeeRecord[] = [];

    let currentRecord: Partial<EmployeeRecord> = {};
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        if (currentRecord.full_name) {
          const record = currentRecord as EmployeeRecord;
          const validationError = this.validateRecord(record, lineNumber);

          if (validationError) {
            errors.push(validationError);
          } else {
            const duplicateKey = `${record.full_name.toLowerCase()}:${record.email?.toLowerCase() || ''}`;
            if (seenKeys.has(duplicateKey)) {
              duplicates.push(record);
              errors.push({
                row_number: lineNumber,
                error_type: 'duplicate',
                error_message: 'Duplicate employee record detected',
                raw_data: record,
              });
            } else {
              seenKeys.add(duplicateKey);
              records.push(record);
            }
          }
          currentRecord = {};
        }
        continue;
      }

      if (/^[A-Z][a-z]+ [A-Z][a-z]+/.test(trimmedLine) && !currentRecord.full_name) {
        currentRecord.full_name = this.normalizeText(trimmedLine.split(/\s{2,}/)[0]);
      } else if (trimmedLine.includes('@')) {
        currentRecord.email = this.normalizeText(trimmedLine);
      } else if (!currentRecord.job_title && trimmedLine.length > 3 && trimmedLine.length < 100) {
        currentRecord.job_title = this.normalizeText(trimmedLine);
      } else if (trimmedLine.toLowerCase().includes('team:')) {
        currentRecord.team = this.normalizeText(trimmedLine.replace(/team:/i, ''));
      } else if (trimmedLine.toLowerCase().includes('department:')) {
        currentRecord.department = this.normalizeText(trimmedLine.replace(/department:/i, ''));
      }
    }

    if (currentRecord.full_name) {
      const record = currentRecord as EmployeeRecord;
      const validationError = this.validateRecord(record, lineNumber);

      if (!validationError) {
        const duplicateKey = `${record.full_name.toLowerCase()}:${record.email?.toLowerCase() || ''}`;
        if (!seenKeys.has(duplicateKey)) {
          records.push(record);
        }
      }
    }

    return {
      records,
      errors,
      duplicates,
      totalRecords: records.length + errors.length,
      validRecords: records.length,
      preview: records.slice(0, 10),
    };
  },

  validateRecord(record: any, rowNumber: number): IngestionError | null {
    if (!record.full_name || record.full_name.length < 2) {
      return {
        row_number: rowNumber,
        error_type: 'validation',
        error_message: 'Full name is required and must be at least 2 characters',
        raw_data: record,
      };
    }

    if (record.email && !this.isValidEmail(record.email)) {
      return {
        row_number: rowNumber,
        error_type: 'validation',
        error_message: 'Invalid email format',
        raw_data: record,
      };
    }

    if (record.full_name.length > 200) {
      return {
        row_number: rowNumber,
        error_type: 'validation',
        error_message: 'Full name exceeds maximum length of 200 characters',
        raw_data: record,
      };
    }

    return null;
  },

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  async createIngestionJob(
    userId: string,
    sourceType: 'csv' | 'text' | 'linkedin',
    parsedData: ParsedData
  ): Promise<string> {
    const { data: job, error } = await supabase
      .from('ingestion_jobs')
      .insert({
        user_id: userId,
        status: 'processing',
        source_type: sourceType,
        total_records: parsedData.totalRecords,
        processed_records: 0,
        failed_records: parsedData.errors.length,
        duplicate_records: parsedData.duplicates.length,
        error_report: parsedData.errors,
      })
      .select()
      .single();

    if (error) throw error;
    return job.id;
  },

  async processIngestion(
    jobId: string,
    records: EmployeeRecord[],
    batchSize: number = 500
  ): Promise<void> {
    const totalBatches = Math.ceil(records.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const batch = records.slice(i * batchSize, (i + 1) * batchSize);

      const employeeData = batch.map((record) => ({
        job_id: jobId,
        full_name: record.full_name,
        job_title: record.job_title,
        team: record.team,
        department: record.department,
        email: record.email,
        phone: record.phone,
        location: record.location,
        raw_data: record,
        normalized_data: {
          full_name: this.normalizeText(record.full_name),
          job_title: record.job_title ? this.normalizeText(record.job_title) : null,
          team: record.team ? this.normalizeText(record.team) : null,
          department: record.department ? this.normalizeText(record.department) : null,
        },
      }));

      await supabase.from('ingested_employees').insert(employeeData);

      await supabase
        .from('ingestion_jobs')
        .update({ processed_records: (i + 1) * batchSize })
        .eq('id', jobId);
    }

    await supabase
      .from('ingestion_jobs')
      .update({
        status: 'completed',
        processed_records: records.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  },

  async getIngestionJob(jobId: string): Promise<IngestionJob | null> {
    const { data, error } = await supabase
      .from('ingestion_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('Error fetching ingestion job:', error);
      return null;
    }

    return data;
  },

  async getUserIngestionJobs(userId: string, limit: number = 50): Promise<IngestionJob[]> {
    const { data, error } = await supabase
      .from('ingestion_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching ingestion jobs:', error);
      return [];
    }

    return data || [];
  },

  async getIngestionErrors(jobId: string): Promise<IngestionError[]> {
    const { data, error } = await supabase
      .from('ingestion_errors')
      .select('*')
      .eq('job_id', jobId)
      .order('row_number');

    if (error) {
      console.error('Error fetching ingestion errors:', error);
      return [];
    }

    return data || [];
  },

  async getIngestedEmployees(jobId: string, limit?: number): Promise<EmployeeRecord[]> {
    let query = supabase
      .from('ingested_employees')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at');

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching ingested employees:', error);
      return [];
    }

    return data || [];
  },

  exportToJSON(records: EmployeeRecord[]): string {
    return JSON.stringify(records, null, 2);
  },

  exportErrorReport(errors: IngestionError[]): string {
    const csv = [
      'Row Number,Error Type,Error Message,Raw Data',
      ...errors.map(
        (err) =>
          `${err.row_number},${err.error_type},${err.error_message},"${JSON.stringify(err.raw_data).replace(/"/g, '""')}"`
      ),
    ].join('\n');

    return csv;
  },

  downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
