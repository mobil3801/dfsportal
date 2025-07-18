import { type Database, supabase } from "@/config/supabase";

// Generic types for database operations
type TableName = keyof Database["public"]["Tables"];
type TableRow<T extends TableName> = Database["public"]["Tables"][T]["Row"];
type TableInsert<T extends TableName> =
  Database["public"]["Tables"][T]["Insert"];
type TableUpdate<T extends TableName> =
  Database["public"]["Tables"][T]["Update"];

// Helper function to convert table names
function getTableName(table: TableName | symbol): string {
  return typeof table === "symbol" ? String(table) : table;
}

// Create (Insert)
export async function createRecord<T extends TableName>(
  table: T,
  data: Partial<Database["public"]["Tables"][T]["Insert"]>,
): Promise<Database["public"]["Tables"][T]["Row"] | null> {
  const tableName = getTableName(table);
  const channelName = `${tableName}_${Date.now()}`;

  try {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data as any)
      .select()
      .single();

    if (error) {
      console.error(`Error creating ${tableName}:`, error);
      return null;
    }

    return result;
  } catch (err) {
    console.error(`Error creating ${tableName}:`, err);
    return null;
  }
}

// Read (Select with pagination)
export async function readRecords<T extends TableName>(
  table: T,
  options: {
    page?: number;
    pageSize?: number;
    orderBy?: keyof TableRow<T>;
    ascending?: boolean;
    filters?: { column: keyof TableRow<T>; operator: string; value: any }[];
    select?: string;
  } = {},
): Promise<{
  data: TableRow<T>[] | null;
  count: number | null;
  error: string | null;
}> {
  try {
    const {
      page = 1,
      pageSize = 10,
      orderBy = "id" as keyof TableRow<T>,
      ascending = false,
      filters = [],
      select = "*",
    } = options;

    let query = supabase
      .from(table)
      .select(select, { count: "exact" });

    // Apply filters
    filters.forEach((filter) => {
      const { column, operator, value } = filter;
      switch (operator.toLowerCase()) {
        case "eq":
          query = query.eq(column as string, value);
          break;
        case "neq":
          query = query.neq(column as string, value);
          break;
        case "gt":
          query = query.gt(column as string, value);
          break;
        case "gte":
          query = query.gte(column as string, value);
          break;
        case "lt":
          query = query.lt(column as string, value);
          break;
        case "lte":
          query = query.lte(column as string, value);
          break;
        case "like":
          query = query.like(column as string, `%${value}%`);
          break;
        case "ilike":
          query = query.ilike(column as string, `%${value}%`);
          break;
        default:
          query = query.eq(column as string, value);
      }
    });

    // Apply ordering
    query = query.order(orderBy as string, { ascending });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error(`Error reading ${table}:`, error);
      return { data: null, count: null, error: error.message };
    }

    return { data: (data as unknown) as TableRow<T>[], count, error: null };
  } catch (err) {
    console.error(`Error reading ${table}:`, err);
    return { data: null, count: null, error: "An unexpected error occurred" };
  }
}

// Update
export async function updateRecord<T extends TableName>(
  table: T,
  id: number,
  data: TableUpdate<T>,
): Promise<{ data: TableRow<T> | null; error: string | null }> {
  try {
    const { data: result, error } = await supabase
      .from(table)
      .update(data as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${table}:`, error);
      return { data: null, error: error.message };
    }

    return { data: result, error: null };
  } catch (err) {
    console.error(`Error updating ${table}:`, err);
    return { data: null, error: "An unexpected error occurred" };
  }
}

// Delete
export async function deleteRecord<T extends TableName>(
  table: T,
  id: number,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`Error deleting from ${table}:`, error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    console.error(`Error deleting from ${table}:`, err);
    return { error: "An unexpected error occurred" };
  }
}

// Batch operations
export async function batchCreate<T extends TableName>(
  table: T,
  data: TableInsert<T>[],
): Promise<{ data: TableRow<T>[] | null; error: string | null }> {
  try {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data as any)
      .select();

    if (error) {
      console.error(`Error batch creating ${table}:`, error);
      return { data: null, error: error.message };
    }

    return { data: result, error: null };
  } catch (err) {
    console.error(`Error batch creating ${table}:`, err);
    return { data: null, error: "An unexpected error occurred" };
  }
}

export async function batchUpdate<T extends TableName>(
  table: T,
  updates: { id: number; data: TableUpdate<T> }[],
): Promise<{ data: TableRow<T>[] | null; error: string | null }> {
  try {
    const results = await Promise.all(
      updates.map(({ id, data }) => updateRecord(table, id, data)),
    );

    const errors = results.filter((r) => r.error).map((r) => r.error);
    if (errors.length > 0) {
      return { data: null, error: errors.join(", ") };
    }

    const data = results.map((r) => r.data).filter(Boolean) as TableRow<T>[];
    return { data, error: null };
  } catch (err) {
    console.error(`Error batch updating ${table}:`, err);
    return { data: null, error: "An unexpected error occurred" };
  }
}

export async function batchDelete<T extends TableName>(
  table: T,
  ids: number[],
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .in("id", ids);

    if (error) {
      console.error(`Error batch deleting from ${table}:`, error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    console.error(`Error batch deleting from ${table}:`, err);
    return { error: "An unexpected error occurred" };
  }
}

// File upload
export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
): Promise<{ data: { path: string } | null; error: string | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading file:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    console.error("Error uploading file:", err);
    return { data: null, error: "An unexpected error occurred" };
  }
}

// Get file URL
export function getFileUrl(bucket: string, path: string): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

// ========================================
// ENHANCED SERVICE METHODS
// ========================================

// Email service
export class EmailService {
  static async sendEmail(emailData: {
    from: string;
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ data?: any; error: string | null }> {
    try {
      // For now, we'll simulate email sending for development
      // In production, this would integrate with an email service like Resend, SendGrid, etc.
      console.log("📧 Email would be sent:", {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        preview: `${emailData.html.substring(0, 100)}...`,
      });

      // You can replace this with actual email service integration
      // For example, using Supabase Edge Functions:
      /*
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: emailData
      });

      if (error) {
        console.error('Email sending error:', error);
        return { error: error.message };
      }

      return { data, error: null };
      */

      // For development, simulate successful email
      return {
        data: {
          message: "Email logged successfully (development mode)",
          emailData,
        },
        error: null,
      };
    } catch (error) {
      console.error("Error in sendEmail:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Authentication service
export class AuthService {
  static async getCurrentUser() {
    try {
      const { data: { user }, error: authError } = await supabase.auth
        .getUser();

      if (authError || !user) {
        return {
          data: null,
          error: authError?.message || "User not authenticated",
        };
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileError) {
        return {
          data: {
            id: user.id,
            email: user.email,
            role: "Employee",
            created_at: user.created_at,
          },
          error: null,
        };
      }

      return {
        data: {
          id: user.id,
          email: user.email,
          ...profile,
        },
        error: null,
      };
    } catch (error) {
      console.error("Error in getCurrentUser:", error);
      return {
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async register(credentials: { email: string; password: string }) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        console.error("Supabase registration error:", error);
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      console.error("Error in register:", error);
      return {
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Helpers so `import { supabase } ...` keeps compiling
export { supabase }; // named export

// Lo-fi realtime stub – replace with real manager later.
export const realtimeManager = {
  subscribe: (..._args: any[]) => {/* no-op */},
  unsubscribe: (..._args: any[]) => {/* no-op */},
};

// ---------------------------------------------
// SINGLE service aggregator & default export
// ---------------------------------------------
export const SupabaseService = {
  createRecord,
  readRecords,
  updateRecord,
  deleteRecord,
  batchCreate,
  batchUpdate,
  batchDelete,
  uploadFile,
  getFileUrl,
  deleteFile,
  subscribeToChanges,
  unsubscribeFromChanges,
  executeRpc,
  searchRecords,
};

export default SupabaseService;
