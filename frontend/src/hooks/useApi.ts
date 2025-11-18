import { useState, useCallback } from "react";

// --- Types matching Backend Pydantic Models ---

export interface ForeignKeyDef {
  table: string;
  column: string;
}

export interface ColumnDef {
  name: string;
  type: string;
  isPrimary?: boolean;
  isForeignKey?: boolean;
  foreignKey?: ForeignKeyDef | null;
}

export interface CreateTableRequest {
  table_name: string;
  columns: ColumnDef[];
}

export interface AddColumnRequest {
  table_name: string;
  column: ColumnDef;
}

export interface RowOperationRequest {
  table_name: string;
  data: Record<string, any>;
  id?: number | string;
}

export interface JoinRequest {
  leftTable: string;
  rightTable: string;
  leftKey: string;
  rightKey: string;
}

export interface TableResponse {
  id: string;
  name: string;
  columns: ColumnDef[];
  rows: Record<string, any>[];
}

// --- Configuration ---
// Uses the environment variable from docker-compose, defaults to localhost for dev
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generic Request Handler
  const request = useCallback(
    async (endpoint: string, method: string = "GET", body?: any) => {
      setLoading(true);
      setError(null);
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        const config: RequestInit = { method, headers };

        if (body) {
          config.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "API Request Failed");
        }

        return data;
      } catch (err: any) {
        setError(err.message);
        console.error("API Error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // --- API Methods ---

  const getTables = useCallback(async (): Promise<string[]> => {
    return await request("/tables");
  }, [request]);

  const getTableData = useCallback(
    async (tableName: string): Promise<TableResponse> => {
      return await request(`/tables/${tableName}`);
    },
    [request]
  );

  const createTable = useCallback(
    async (payload: CreateTableRequest) => {
      return await request("/create-table", "POST", payload);
    },
    [request]
  );

  const dropTable = useCallback(
    async (tableName: string) => {
      return await request(`/tables/${tableName}`, "DELETE");
    },
    [request]
  );

  const addColumn = useCallback(
    async (payload: AddColumnRequest) => {
      return await request("/add-column", "POST", payload);
    },
    [request]
  );

  const insertRow = useCallback(
    async (payload: RowOperationRequest) => {
      return await request("/rows/insert", "POST", payload);
    },
    [request]
  );

  const updateRow = useCallback(
    async (payload: RowOperationRequest) => {
      return await request("/rows/update", "POST", payload);
    },
    [request]
  );

  const runJoin = useCallback(
    async (payload: JoinRequest): Promise<Record<string, any>[]> => {
      return await request("/query/join", "POST", payload);
    },
    [request]
  );

  return {
    loading,
    error,
    getTables,
    getTableData,
    createTable,
    dropTable,
    addColumn,
    insertRow,
    updateRow,
    runJoin,
  };
};
