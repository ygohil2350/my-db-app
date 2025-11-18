import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Divider,
  Tooltip,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  FormControlLabel,
  Checkbox,
  CssBaseline,
  Alert,
} from "@mui/material";
import {
  Storage as StorageIcon,
  TableChart as TableChartIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ViewColumn as ViewColumnIcon,
  Code as CodeIcon,
  Key as KeyIcon,
  Link as LinkIcon,
  MergeType as MergeTypeIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  ArrowForward as ArrowRightIcon,
  DataObject as JsonIcon,
  CalendarToday as DateIcon,
  Numbers as NumberIcon,
  ToggleOn as BoolIcon,
  TextFields as TextIcon,
} from "@mui/icons-material";

import { useApi } from "./hooks/useApi";
import type { TableResponse, ColumnDef } from "./hooks/useApi";
import type { SelectChangeEvent } from "@mui/material";

// --- Types & Interfaces ---

interface Row {
  [key: string]: any;
}

interface NewColumnData {
  name: string;
  type: string;
  isPrimary: boolean;
  isForeignKey: boolean;
  fkTable: string;
  fkColumn: string;
}

interface JoinConfig {
  leftTable: string;
  rightTable: string;
  leftKey: string;
  rightKey: string;
}

// --- Constants ---

const DATA_TYPES = [
  { label: "Integer", value: "INTEGER", icon: NumberIcon },
  { label: "Text", value: "VARCHAR(255)", icon: TextIcon },
  { label: "Boolean", value: "BOOLEAN", icon: BoolIcon },
  { label: "Date", value: "DATE", icon: DateIcon },
  { label: "JSON", value: "JSONB", icon: JsonIcon },
];

export default function App() {
  // --- Hooks ---
  const api = useApi();

  // --- State ---
  const [viewMode, setViewMode] = useState<"data" | "query">("data");
  const [tables, setTables] = useState<TableResponse[]>([]);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [sqlLogs, setSqlLogs] = useState<string[]>(["-- System initialized"]);
  const [joinResults, setJoinResults] = useState<Row[]>([]);

  // Modal States
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isRowModalOpen, setIsRowModalOpen] = useState(false);

  // Form States
  const [newTableName, setNewTableName] = useState("");
  const [editingRowId, setEditingRowId] = useState<number | string | null>(
    null
  );

  const [newColumnData, setNewColumnData] = useState<NewColumnData>({
    name: "",
    type: "VARCHAR(255)",
    isPrimary: false,
    isForeignKey: false,
    fkTable: "",
    fkColumn: "",
  });

  const [newRowData, setNewRowData] = useState<Row>({});

  // Join/Query State
  const [joinConfig, setJoinConfig] = useState<JoinConfig>({
    leftTable: "",
    rightTable: "",
    leftKey: "",
    rightKey: "",
  });

  const activeTable = tables.find((t) => t.id === activeTableId);

  // --- Data Fetching Helper ---

  const refreshTables = async () => {
    try {
      const tableNames = await api.getTables();
      const fullTables = await Promise.all(
        tableNames.map((name) => api.getTableData(name))
      );
      setTables(fullTables);

      if (activeTableId && !tableNames.includes(activeTableId)) {
        setActiveTableId(tableNames.length > 0 ? tableNames[0] : null);
      } else if (!activeTableId && tableNames.length > 0) {
        setActiveTableId(tableNames[0]);
      }
    } catch (err) {
      addLog(`[Error] Failed to refresh tables: ${err}`);
    }
  };

  // Initial Load
  useEffect(() => {
    refreshTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Join Data Fetcher
  useEffect(() => {
    const fetchJoin = async () => {
      if (
        viewMode === "query" &&
        joinConfig.leftTable &&
        joinConfig.rightTable &&
        joinConfig.leftKey &&
        joinConfig.rightKey
      ) {
        try {
          const results = await api.runJoin(joinConfig);
          setJoinResults(results);
          addLog(
            `Executed JOIN: ${joinConfig.leftTable} ⨝ ${joinConfig.rightTable}`
          );
        } catch (err) {
          addLog(`[Error] Join failed: ${err}`);
        }
      }
    };

    const timeoutId = setTimeout(fetchJoin, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinConfig, viewMode]);

  // --- Actions ---

  const addLog = (query: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSqlLogs((prev) => [`[${timestamp}] ${query}`, ...prev]);
  };

  const createTable = async () => {
    if (!newTableName.trim()) return;
    const id = newTableName.toLowerCase().replace(/\s+/g, "_");

    try {
      await api.createTable({
        table_name: id,
        columns: [{ name: "id", type: "INTEGER", isPrimary: true }],
      });
      addLog(`CREATE TABLE ${id} (id INTEGER PRIMARY KEY);`);

      await refreshTables();
      setActiveTableId(id);
      setNewTableName("");
      setIsTableModalOpen(false);
    } catch (err: any) {
      addLog(`[Error] Create Table: ${err.message}`);
    }
  };

  const addColumn = async () => {
    if (!newColumnData.name.trim() || !activeTableId) return;

    const newCol: ColumnDef = {
      name: newColumnData.name,
      type: newColumnData.type,
      isPrimary: newColumnData.isPrimary,
      isForeignKey: newColumnData.isForeignKey,
      foreignKey:
        newColumnData.isForeignKey &&
        newColumnData.fkTable &&
        newColumnData.fkColumn
          ? { table: newColumnData.fkTable, column: newColumnData.fkColumn }
          : undefined,
    };

    try {
      await api.addColumn({
        table_name: activeTableId,
        column: newCol,
      });

      let sql = `ALTER TABLE ${activeTableId} ADD COLUMN ${newColumnData.name} ${newColumnData.type}`;
      if (newColumnData.isPrimary) sql += " PRIMARY KEY";
      if (newColumnData.isForeignKey)
        sql += ` REFERENCES ${newColumnData.fkTable}(${newColumnData.fkColumn})`;
      addLog(sql + ";");

      await refreshTables();
      setNewColumnData({
        name: "",
        type: "VARCHAR(255)",
        isPrimary: false,
        isForeignKey: false,
        fkTable: "",
        fkColumn: "",
      });
      setIsColumnModalOpen(false);
    } catch (err: any) {
      addLog(`[Error] Add Column: ${err.message}`);
    }
  };

  const openAddRowModal = () => {
    setEditingRowId(null);
    setNewRowData({});
    setIsRowModalOpen(true);
  };

  const openEditRowModal = (row: Row) => {
    if (row.id !== undefined && row.id !== null) {
      setEditingRowId(row.id as string | number);
    }
    setNewRowData({ ...row });
    setIsRowModalOpen(true);
  };

  const saveRow = async () => {
    if (!activeTableId) return;

    try {
      if (editingRowId !== null) {
        await api.updateRow({
          table_name: activeTableId,
          id: editingRowId,
          data: newRowData,
        });

        const setClause = Object.entries(newRowData)
          .filter(([k]) => k !== "id")
          .map(([k, v]) => `${k}='${v}'`)
          .join(", ");
        addLog(
          `UPDATE ${activeTableId} SET ${setClause} WHERE id=${editingRowId};`
        );
      } else {
        await api.insertRow({
          table_name: activeTableId,
          data: newRowData,
        });

        const columns = Object.keys(newRowData).join(", ");
        const values = Object.values(newRowData)
          .map((v) => `'${v}'`)
          .join(", ");
        addLog(
          `INSERT INTO ${activeTableId} (${columns || "id"}) VALUES (${
            values || "DEFAULT"
          });`
        );
      }

      await refreshTables();
      setNewRowData({});
      setIsRowModalOpen(false);
    } catch (err: any) {
      addLog(`[Error] Row Operation: ${err.message}`);
    }
  };

  const deleteTable = async (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to DROP table "${tableId}"?`)) {
      try {
        await api.dropTable(tableId);
        addLog(`DROP TABLE ${tableId};`);
        await refreshTables();
      } catch (err: any) {
        addLog(`[Error] Drop Table: ${err.message}`);
      }
    }
  };

  const joinColumns = joinResults.length > 0 ? Object.keys(joinResults[0]) : [];

  // --- Input Renderer for Dynamic Types ---
  const renderInput = (col: ColumnDef) => {
    const val =
      newRowData[col.name] !== undefined && newRowData[col.name] !== null
        ? newRowData[col.name]
        : "";
    const isPK = col.isPrimary && editingRowId === null;

    // 1. Boolean (Select)
    if (col.type === "BOOLEAN") {
      return (
        <FormControl fullWidth key={col.name}>
          <InputLabel id={`select-${col.name}`}>{col.name}</InputLabel>
          <Select
            labelId={`select-${col.name}`}
            value={String(val)}
            label={col.name}
            onChange={(e) =>
              setNewRowData({ ...newRowData, [col.name]: e.target.value })
            }
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            <MenuItem value="true">True</MenuItem>
            <MenuItem value="false">False</MenuItem>
          </Select>
        </FormControl>
      );
    }

    // 2. Integer (Number Input)
    if (col.type.includes("INT")) {
      return (
        <TextField
          key={col.name}
          label={col.name}
          type="number"
          disabled={isPK}
          placeholder={isPK ? "(Auto)" : ""}
          value={val}
          onChange={(e) =>
            setNewRowData({ ...newRowData, [col.name]: e.target.value })
          }
          InputProps={{
            endAdornment: (
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {col.isPrimary && (
                  <KeyIcon fontSize="small" sx={{ color: "warning.light" }} />
                )}
                {col.foreignKey && (
                  <LinkIcon fontSize="small" sx={{ color: "info.light" }} />
                )}
              </Box>
            ),
          }}
        />
      );
    }

    // 3. Date (Date Picker)
    if (col.type === "DATE") {
      return (
        <TextField
          key={col.name}
          label={col.name}
          type="date"
          value={val}
          onChange={(e) =>
            setNewRowData({ ...newRowData, [col.name]: e.target.value })
          }
          InputLabelProps={{ shrink: true }}
          InputProps={{
            endAdornment: (
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {col.isPrimary && (
                  <KeyIcon fontSize="small" sx={{ color: "warning.light" }} />
                )}
                {col.foreignKey && (
                  <LinkIcon fontSize="small" sx={{ color: "info.light" }} />
                )}
              </Box>
            ),
          }}
        />
      );
    }

    // 4. JSON (Multiline)
    if (col.type === "JSONB" || col.type === "JSON") {
      return (
        <TextField
          key={col.name}
          label={col.name}
          multiline
          rows={4}
          placeholder='{"key": "value"}'
          value={typeof val === "object" ? JSON.stringify(val, null, 2) : val}
          onChange={(e) =>
            setNewRowData({ ...newRowData, [col.name]: e.target.value })
          }
          InputProps={{
            endAdornment: (
              <Box
                sx={{
                  display: "flex",
                  gap: 0.5,
                  alignSelf: "flex-start",
                  mt: 1,
                }}
              >
                <JsonIcon fontSize="small" sx={{ color: "action.active" }} />
              </Box>
            ),
          }}
        />
      );
    }

    // Default (Text)
    return (
      <TextField
        key={col.name}
        label={col.name}
        disabled={isPK}
        placeholder={isPK ? "(Auto)" : ""}
        value={val}
        onChange={(e) =>
          setNewRowData({ ...newRowData, [col.name]: e.target.value })
        }
        InputProps={{
          endAdornment: (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {col.isPrimary && (
                <KeyIcon fontSize="small" sx={{ color: "warning.light" }} />
              )}
              {col.foreignKey && (
                <LinkIcon fontSize="small" sx={{ color: "info.light" }} />
              )}
            </Box>
          ),
        }}
      />
    );
  };

  // --- Renders ---

  return (
    <>
      <CssBaseline />
      <Box
        sx={{
          display: "flex",
          height: "100vh",
          width: "100vw",
          bgcolor: "grey.100",
          overflow: "hidden",
        }}
      >
        {/* Sidebar */}
        <Paper
          square
          elevation={2}
          sx={{
            width: 260,
            bgcolor: "#1a2027",
            color: "grey.300",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #333",
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              p: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
              borderBottom: "1px solid #333",
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                bgcolor: "primary.main",
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              <StorageIcon sx={{ color: "#fff", fontSize: 20 }} />
            </Box>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}
            >
              DB Architect
            </Typography>
          </Box>

          <Box sx={{ px: 2, py: 2 }}>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                bgcolor: "#2c343d",
                p: 0.5,
                borderRadius: 1,
                mb: 3,
              }}
            >
              <Button
                fullWidth
                size="small"
                startIcon={<TableChartIcon />}
                onClick={() => setViewMode("data")}
                sx={{
                  color: viewMode === "data" ? "#fff" : "grey.500",
                  bgcolor: viewMode === "data" ? "primary.main" : "transparent",
                  "&:hover": {
                    bgcolor:
                      viewMode === "data"
                        ? "primary.dark"
                        : "rgba(255,255,255,0.05)",
                  },
                }}
              >
                Data
              </Button>
              <Button
                fullWidth
                size="small"
                startIcon={<MergeTypeIcon />}
                onClick={() => setViewMode("query")}
                sx={{
                  color: viewMode === "query" ? "#fff" : "grey.500",
                  bgcolor:
                    viewMode === "query" ? "primary.main" : "transparent",
                  "&:hover": {
                    bgcolor:
                      viewMode === "query"
                        ? "primary.dark"
                        : "rgba(255,255,255,0.05)",
                  },
                }}
              >
                Query
              </Button>
            </Box>

            {viewMode === "data" && (
              <>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                    px: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: "bold",
                      color: "grey.600",
                      textTransform: "uppercase",
                    }}
                  >
                    Tables
                  </Typography>
                  <IconButton
                    size="small"
                    sx={{ color: "primary.light" }}
                    onClick={() => setIsTableModalOpen(true)}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>

                <List dense sx={{ p: 0 }}>
                  {tables.map((table) => (
                    <ListItem
                      key={table.id}
                      disablePadding
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={(e) => deleteTable(e, table.id)}
                          sx={{
                            color: "grey.600",
                            "&:hover": { color: "error.main" },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      }
                      sx={{
                        mb: 0.5,
                        borderRadius: 1,
                        bgcolor:
                          activeTableId === table.id
                            ? "rgba(25, 118, 210, 0.15)"
                            : "transparent",
                        border:
                          activeTableId === table.id
                            ? "1px solid rgba(25, 118, 210, 0.3)"
                            : "1px solid transparent",
                      }}
                    >
                      <ListItemButton
                        onClick={() => setActiveTableId(table.id)}
                        sx={{ borderRadius: 1 }}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <TableChartIcon
                            sx={{
                              fontSize: 18,
                              color:
                                activeTableId === table.id
                                  ? "primary.light"
                                  : "grey.600",
                            }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={table.name}
                          primaryTypographyProps={{
                            fontSize: "0.875rem",
                            fontWeight: activeTableId === table.id ? 600 : 400,
                            color:
                              activeTableId === table.id
                                ? "primary.light"
                                : "grey.400",
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                  {tables.length === 0 && !api.loading && (
                    <Typography
                      variant="caption"
                      sx={{ color: "grey.600", p: 2, fontStyle: "italic" }}
                    >
                      No tables found.
                    </Typography>
                  )}
                </List>
              </>
            )}

            {viewMode === "query" && (
              <Box sx={{ p: 2, color: "grey.500" }}>
                <Typography variant="body2" gutterBottom>
                  Query Builder Active
                </Typography>
                <Typography variant="caption">
                  Select two tables to visualize an INNER JOIN operation.
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ mt: "auto", p: 2, borderTop: "1px solid #333" }}>
            <Paper
              sx={{ bgcolor: "#2c343d", p: 2, borderRadius: 1 }}
              elevation={0}
            >
              <Stack spacing={1}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      bgcolor: api.error ? "error.main" : "success.main",
                      borderRadius: "50%",
                    }}
                  />
                  <Typography variant="caption" sx={{ color: "grey.300" }}>
                    API:{" "}
                    {api.loading
                      ? "Loading..."
                      : api.error
                      ? "Error"
                      : "Connected"}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
        </Paper>

        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            bgcolor: "#f5f5f5",
          }}
        >
          {/* Header */}
          <Paper
            square
            elevation={0}
            sx={{
              px: 3,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid",
              borderColor: "grey.300",
              bgcolor: "#fff",
            }}
          >
            {viewMode === "data" ? (
              <>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "text.primary" }}
                  >
                    {activeTable ? activeTable.name : "No Table Selected"}
                  </Typography>
                  {activeTable && (
                    <Chip
                      label={`${activeTable.rows.length} rows`}
                      size="small"
                      sx={{ bgcolor: "grey.100" }}
                    />
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<ViewColumnIcon />}
                    disabled={!activeTable || api.loading}
                    onClick={() => setIsColumnModalOpen(true)}
                  >
                    Add Column
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    disabled={!activeTable || api.loading}
                    onClick={openAddRowModal}
                  >
                    Insert Row
                  </Button>
                </Box>
              </>
            ) : (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: "text.primary",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <MergeTypeIcon color="primary" /> Join Simulator
              </Typography>
            )}
          </Paper>

          {/* Workspace */}
          <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Main View Area */}
            <Box sx={{ flex: 1, overflow: "auto", p: 3, position: "relative" }}>
              {/* Global Error Alert */}
              {api.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {api.error}
                </Alert>
              )}

              {viewMode === "data" ? (
                /* DATA TABLE VIEW */
                activeTable ? (
                  <TableContainer
                    component={Paper}
                    sx={{ boxShadow: 2, borderRadius: 2, overflow: "hidden" }}
                  >
                    <Table stickyHeader size="medium">
                      <TableHead>
                        <TableRow>
                          {activeTable.columns.map((col) => (
                            <TableCell
                              key={col.name}
                              sx={{
                                bgcolor: "grey.50",
                                fontWeight: "bold",
                                color: "text.secondary",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                {col.isPrimary && (
                                  <Tooltip title="Primary Key">
                                    <KeyIcon
                                      sx={{
                                        fontSize: 16,
                                        color: "warning.main",
                                      }}
                                    />
                                  </Tooltip>
                                )}
                                {col.foreignKey && (
                                  <Tooltip
                                    title={`FK: ${col.foreignKey.table}.${col.foreignKey.column}`}
                                  >
                                    <LinkIcon
                                      sx={{ fontSize: 16, color: "info.main" }}
                                    />
                                  </Tooltip>
                                )}
                                {col.name}
                                <Chip
                                  label={col.type}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    height: 20,
                                    fontSize: "0.65rem",
                                    borderRadius: 1,
                                  }}
                                />
                              </Box>
                            </TableCell>
                          ))}
                          <TableCell
                            align="right"
                            sx={{ bgcolor: "grey.50", width: 80 }}
                          >
                            Actions
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeTable.rows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={activeTable.columns.length + 1}
                              align="center"
                              sx={{ py: 8 }}
                            >
                              <Typography color="text.secondary">
                                No data found in {activeTable.name}. Insert a
                                row to get started.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          activeTable.rows.map((row, idx) => (
                            <TableRow
                              key={idx}
                              hover
                              sx={{ "&:hover": { bgcolor: "action.hover" } }}
                            >
                              {activeTable.columns.map((col) => (
                                <TableCell
                                  key={col.name}
                                  sx={{ color: "text.primary" }}
                                >
                                  {row[col.name] !== undefined &&
                                  row[col.name] !== null ? (
                                    String(row[col.name])
                                  ) : (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontStyle: "italic",
                                        color: "text.disabled",
                                      }}
                                    >
                                      NULL
                                    </Typography>
                                  )}
                                </TableCell>
                              ))}
                              <TableCell align="right">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditRowModal(row)}
                                  color="primary"
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.6,
                    }}
                  >
                    <StorageIcon
                      sx={{ fontSize: 64, color: "grey.300", mb: 2 }}
                    />
                    <Typography variant="h6" color="text.secondary">
                      Select a table to view data
                    </Typography>
                    <Button
                      variant="contained"
                      sx={{ mt: 2 }}
                      onClick={() => setIsTableModalOpen(true)}
                    >
                      Create Table
                    </Button>
                  </Box>
                )
              ) : (
                /* QUERY BUILDER VIEW */
                <Stack spacing={4}>
                  <Paper sx={{ p: 3, borderRadius: 2 }} elevation={1}>
                    <Stack
                      direction="row"
                      alignItems="flex-end"
                      spacing={3}
                      flexWrap="wrap"
                    >
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Left Table</InputLabel>
                        <Select
                          value={joinConfig.leftTable}
                          label="Left Table"
                          onChange={(e: SelectChangeEvent) =>
                            setJoinConfig({
                              ...joinConfig,
                              leftTable: e.target.value,
                            })
                          }
                        >
                          {tables.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                              {t.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          color: "primary.main",
                          pb: 1,
                        }}
                      >
                        <ArrowRightIcon />
                        <Chip
                          label="INNER JOIN"
                          color="primary"
                          variant="outlined"
                          size="small"
                          sx={{
                            mx: 1,
                            fontWeight: "bold",
                            bgcolor: "primary.50",
                            border: "1px solid",
                            borderColor: "primary.main",
                          }}
                        />
                        <ArrowRightIcon />
                      </Box>

                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Right Table</InputLabel>
                        <Select
                          value={joinConfig.rightTable}
                          label="Right Table"
                          onChange={(e: SelectChangeEvent) =>
                            setJoinConfig({
                              ...joinConfig,
                              rightTable: e.target.value,
                            })
                          }
                        >
                          {tables.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                              {t.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>

                    <Divider sx={{ my: 3 }} />

                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        ON Condition:
                      </Typography>

                      <Paper
                        variant="outlined"
                        sx={{
                          p: 0.5,
                          display: "flex",
                          alignItems: "center",
                          bgcolor: "grey.50",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ px: 1, color: "text.secondary" }}
                        >
                          {joinConfig.leftTable || "..."}.
                        </Typography>
                        <Select
                          variant="standard"
                          disableUnderline
                          value={joinConfig.leftKey}
                          onChange={(e: SelectChangeEvent) =>
                            setJoinConfig({
                              ...joinConfig,
                              leftKey: e.target.value,
                            })
                          }
                          sx={{
                            fontWeight: "bold",
                            color: "text.primary",
                            minWidth: 80,
                          }}
                        >
                          {tables
                            .find((t) => t.id === joinConfig.leftTable)
                            ?.columns.map((c) => (
                              <MenuItem key={c.name} value={c.name}>
                                {c.name}
                              </MenuItem>
                            ))}
                        </Select>
                      </Paper>

                      <Typography variant="h6" color="text.secondary">
                        =
                      </Typography>

                      <Paper
                        variant="outlined"
                        sx={{
                          p: 0.5,
                          display: "flex",
                          alignItems: "center",
                          bgcolor: "grey.50",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ px: 1, color: "text.secondary" }}
                        >
                          {joinConfig.rightTable || "..."}.
                        </Typography>
                        <Select
                          variant="standard"
                          disableUnderline
                          value={joinConfig.rightKey}
                          onChange={(e: SelectChangeEvent) =>
                            setJoinConfig({
                              ...joinConfig,
                              rightKey: e.target.value,
                            })
                          }
                          sx={{
                            fontWeight: "bold",
                            color: "text.primary",
                            minWidth: 80,
                          }}
                        >
                          {tables
                            .find((t) => t.id === joinConfig.rightTable)
                            ?.columns.map((c) => (
                              <MenuItem key={c.name} value={c.name}>
                                {c.name}
                              </MenuItem>
                            ))}
                        </Select>
                      </Paper>
                    </Box>
                  </Paper>

                  {/* Results */}
                  <TableContainer
                    component={Paper}
                    elevation={1}
                    sx={{ borderRadius: 2 }}
                  >
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: "grey.50",
                        borderBottom: 1,
                        borderColor: "divider",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Query Results
                      </Typography>
                      <Chip
                        label={`${joinResults.length} matches`}
                        size="small"
                      />
                    </Box>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {joinColumns.map((key) => (
                            <TableCell
                              key={key}
                              sx={{ fontWeight: "bold", bgcolor: "#fff" }}
                            >
                              {key}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {joinResults.length > 0 ? (
                          joinResults.map((row, i) => (
                            <TableRow key={i} hover>
                              {joinColumns.map((key) => (
                                <TableCell key={key}>
                                  {row[key] !== undefined && row[key] !== null
                                    ? String(row[key])
                                    : ""}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={Math.max(joinColumns.length, 1)}
                              align="center"
                              sx={{ py: 4 }}
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                No matching records found for this join
                                condition.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              )}
            </Box>

            {/* SQL Logger / Inspector */}
            <Paper
              square
              elevation={3}
              sx={{
                width: 320,
                bgcolor: "#1e1e1e",
                color: "#d4d4d4",
                display: "flex",
                flexDirection: "column",
                borderLeft: "1px solid #333",
              }}
            >
              <Box
                sx={{
                  p: 2,
                  borderBottom: "1px solid #333",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <CodeIcon fontSize="small" /> SQL LOGS
                </Typography>
                <Button
                  size="small"
                  onClick={() => setSqlLogs([])}
                  sx={{ color: "grey.500", minWidth: "auto", p: 0.5 }}
                >
                  Clear
                </Button>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  p: 2,
                  fontFamily: "Monospace",
                  fontSize: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                {sqlLogs.map((log, i) => (
                  <Box
                    key={i}
                    sx={{ borderLeft: "2px solid #2196f3", pl: 1.5, py: 0.5 }}
                  >
                    {log}
                  </Box>
                ))}
                {sqlLogs.length === 0 && (
                  <Typography
                    variant="caption"
                    sx={{ fontStyle: "italic", color: "grey.700" }}
                  >
                    No operations yet...
                  </Typography>
                )}
              </Box>
              <Box
                sx={{ p: 2, borderTop: "1px solid #333", bgcolor: "#252526" }}
              >
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  startIcon={<RefreshIcon />}
                  onClick={refreshTables}
                >
                  Refresh Data
                </Button>
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* --- Modals --- */}

        {/* Create Table Modal */}
        <Dialog
          open={isTableModalOpen}
          onClose={() => setIsTableModalOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Create New Table</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Table Name"
              placeholder="e.g. products"
              fullWidth
              variant="outlined"
              value={newTableName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewTableName(e.target.value)
              }
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setIsTableModalOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button
              onClick={createTable}
              variant="contained"
              disabled={api.loading}
            >
              Create Table
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Column Modal */}
        <Dialog
          open={isColumnModalOpen}
          onClose={() => setIsColumnModalOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add Column to {activeTable?.name}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                autoFocus
                label="Column Name"
                placeholder="e.g. price"
                fullWidth
                value={newColumnData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewColumnData({ ...newColumnData, name: e.target.value })
                }
              />
              <FormControl fullWidth>
                <InputLabel>Data Type</InputLabel>
                <Select
                  value={newColumnData.type}
                  label="Data Type"
                  onChange={(e: SelectChangeEvent) =>
                    setNewColumnData({ ...newColumnData, type: e.target.value })
                  }
                >
                  {DATA_TYPES.map((dt) => (
                    <MenuItem key={dt.value} value={dt.value}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        {dt.icon && <dt.icon fontSize="small" color="action" />}
                        {dt.label} ({dt.value})
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newColumnData.isPrimary}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewColumnData({
                          ...newColumnData,
                          isPrimary: e.target.checked,
                        })
                      }
                    />
                  }
                  label={
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                      <KeyIcon
                        fontSize="small"
                        sx={{ color: "warning.main" }}
                      />{" "}
                      Primary Key
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newColumnData.isForeignKey}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewColumnData({
                          ...newColumnData,
                          isForeignKey: e.target.checked,
                        })
                      }
                    />
                  }
                  label={
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                      <LinkIcon fontSize="small" sx={{ color: "info.main" }} />{" "}
                      Foreign Key
                    </Box>
                  }
                />
              </Box>

              {newColumnData.isForeignKey && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: "grey.50" }}>
                  <Stack spacing={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>References Table</InputLabel>
                      <Select
                        value={newColumnData.fkTable}
                        label="References Table"
                        onChange={(e: SelectChangeEvent) =>
                          setNewColumnData({
                            ...newColumnData,
                            fkTable: e.target.value,
                          })
                        }
                      >
                        <MenuItem value="">
                          <em>Select Table</em>
                        </MenuItem>
                        {tables
                          .filter((t) => t.id !== activeTableId)
                          .map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                              {t.name}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                    <FormControl
                      fullWidth
                      size="small"
                      disabled={!newColumnData.fkTable}
                    >
                      <InputLabel>References Column</InputLabel>
                      <Select
                        value={newColumnData.fkColumn}
                        label="References Column"
                        onChange={(e: SelectChangeEvent) =>
                          setNewColumnData({
                            ...newColumnData,
                            fkColumn: e.target.value,
                          })
                        }
                      >
                        <MenuItem value="">
                          <em>Select Column</em>
                        </MenuItem>
                        {tables
                          .find((t) => t.id === newColumnData.fkTable)
                          ?.columns.map((c) => (
                            <MenuItem key={c.name} value={c.name}>
                              {c.name}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setIsColumnModalOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button
              onClick={addColumn}
              variant="contained"
              disabled={api.loading}
            >
              Add Column
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add/Edit Row Modal */}
        <Dialog
          open={isRowModalOpen}
          onClose={() => setIsRowModalOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>
            {editingRowId !== null ? "Edit Row" : "Insert New Row"}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {activeTable?.columns.map((col) => renderInput(col))}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setIsRowModalOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button
              onClick={saveRow}
              variant="contained"
              disabled={api.loading}
            >
              {editingRowId !== null ? "Update" : "Insert"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
}
