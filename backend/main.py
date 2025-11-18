from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text, inspect
from typing import List, Optional, Any, Dict
import os
import json  
from datetime import datetime 

app = FastAPI()

# --- CORS Configuration ---
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Connection ---
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/builder_db")
engine = create_engine(DATABASE_URL)

# --- Pydantic Models ---

class ForeignKeyDef(BaseModel):
    table: str
    column: str

class ColumnDef(BaseModel):
    name: str
    type: str
    isPrimary: bool = False
    isForeignKey: bool = False
    foreignKey: Optional[ForeignKeyDef] = None

class CreateTableRequest(BaseModel):
    table_name: str
    columns: List[ColumnDef]

class AddColumnRequest(BaseModel):
    table_name: str
    column: ColumnDef

class RowOperationRequest(BaseModel):
    table_name: str
    data: Dict[str, Any]
    id: Optional[int] = None

class JoinRequest(BaseModel):
    leftTable: str
    rightTable: str
    leftKey: str
    rightKey: str

# --- Helper Functions ---

def execute_raw_sql(sql: str):
    """Executes raw SQL safely."""
    try:
        with engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
    except Exception as e:
        print(f"SQL Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

def format_value(val: Any) -> str:
    """
    Sanitizes values for SQL.
    1. Converts Python Dicts/Lists to valid JSON strings (Double Quotes).
    2. Converts 'DD/MM/YYYY' to 'YYYY-MM-DD' for Postgres dates.
    3. Escapes single quotes for string safety.
    """
    if val is None or val == '':
        return "NULL"
    
    # --- FIX: Handle JSON Data ---
    # Python uses single quotes {'k': 'v'} by default, which Postgres rejects.
    # json.dumps() forces double quotes {"k": "v"}, which Postgres accepts.
    if isinstance(val, (dict, list)):
        val = json.dumps(val)

    str_val = str(val).strip()
    
    # --- FIX: Handle Date Format ---
    # Tries to detect DD/MM/YYYY (e.g. 21/12/1999) and convert to YYYY-MM-DD
    if '/' in str_val and len(str_val) == 10:
        try:
            dt = datetime.strptime(str_val, "%d/%m/%Y")
            return f"'{dt.strftime('%Y-%m-%d')}'"
        except ValueError:
            pass # Not a date matching that format, ignore

    # Escape single quotes to prevent SQL syntax errors
    safe_val = str_val.replace("'", "''")
    return f"'{safe_val}'"

# --- Endpoints ---

@app.get("/")
def read_root():
    return {"status": "active", "service": "DB Builder API"}

@app.get("/tables")
def get_tables():
    inspector = inspect(engine)
    return inspector.get_table_names()

@app.get("/tables/{table_name}")
def get_table_data(table_name: str):
    inspector = inspect(engine)
    
    if not inspector.has_table(table_name):
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")

    # Safe Primary Key Extraction
    pk_constraint = inspector.get_pk_constraint(table_name)
    pk_columns = pk_constraint.get("constrained_columns", []) if pk_constraint else []

    columns = []
    for col in inspector.get_columns(table_name):
        col_data = {
            "name": col["name"],
            "type": str(col["type"]),
            "isPrimary": col["name"] in pk_columns
        }
        columns.append(col_data)

    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT * FROM {table_name} LIMIT 100"))
        rows = [dict(row._mapping) for row in result]

    return {"id": table_name, "name": table_name, "columns": columns, "rows": rows}

@app.post("/create-table")
def create_table(req: CreateTableRequest):
    col_defs = []
    
    if not req.columns:
        col_defs.append("id SERIAL PRIMARY KEY")
    else:
        for col in req.columns:
            def_str = f"{col.name} {col.type}"
            if col.isPrimary:
                if "INT" in col.type.upper():
                    def_str = f"{col.name} SERIAL PRIMARY KEY"
                else:
                    def_str += " PRIMARY KEY"
            col_defs.append(def_str)

    sql = f"CREATE TABLE {req.table_name} ({', '.join(col_defs)});"
    execute_raw_sql(sql)
    return {"message": f"Table {req.table_name} created successfully."}

@app.post("/add-column")
def add_column(req: AddColumnRequest):
    col = req.column
    sql_parts = [f"ALTER TABLE {req.table_name} ADD COLUMN {col.name} {col.type}"]
    
    if col.isPrimary:
        sql_parts.append("PRIMARY KEY")
        
    if col.isForeignKey and col.foreignKey:
        sql_parts.append(f"REFERENCES {col.foreignKey.table}({col.foreignKey.column})")
    
    sql = " ".join(sql_parts) + ";"
    execute_raw_sql(sql)
    return {"message": f"Column {col.name} added."}

@app.post("/rows/insert")
def insert_row(req: RowOperationRequest):
    # Filter empty values
    clean_data = {k: v for k, v in req.data.items() if v != '' and v is not None}
    
    if not clean_data:
        raise HTTPException(status_code=400, detail="No data provided")

    cols = ", ".join(clean_data.keys())
    # Use format_value to handle JSON, Dates, and Strings properly
    vals = ", ".join([format_value(v) for v in clean_data.values()]) 
    
    sql = f"INSERT INTO {req.table_name} ({cols}) VALUES ({vals});"
    execute_raw_sql(sql)
    return {"message": "Row inserted."}

@app.post("/rows/update")
def update_row(req: RowOperationRequest):
    if not req.id:
        raise HTTPException(status_code=400, detail="Row ID is required for updates.")
    
    # Use format_value to handle JSON, Dates, and Strings properly
    set_clauses = [f"{k} = {format_value(v)}" for k, v in req.data.items() if k != 'id']
    
    if not set_clauses:
        return {"message": "No data to update."}
        
    sql = f"UPDATE {req.table_name} SET {', '.join(set_clauses)} WHERE id = {req.id};"
    execute_raw_sql(sql)
    return {"message": "Row updated."}

@app.post("/query/join")
def query_join(req: JoinRequest):
    sql = f"""
    SELECT * FROM {req.leftTable} 
    INNER JOIN {req.rightTable} 
    ON {req.leftTable}.{req.leftKey} = {req.rightTable}.{req.rightKey}
    LIMIT 100;
    """
    
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        rows = [dict(row._mapping) for row in result]
        
    return rows

@app.delete("/tables/{table_name}")
def drop_table(table_name: str):
    execute_raw_sql(f"DROP TABLE IF EXISTS {table_name} CASCADE;")
    return {"message": f"Table {table_name} dropped."}