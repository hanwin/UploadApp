import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip, CircularProgress,
  TextField, MenuItem, Select, FormControl, InputLabel, Pagination,
  Stack, Collapse, Alert
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { logsAPI } from '../services/api';

const EVENT_COLORS = {
  login_success: 'success',
  login_failure: 'error',
  logout: 'default',
  upload_success: 'info',
  upload_failure: 'error',
  file_delete: 'warning',
};

const EVENT_LABELS = {
  login_success: 'Inloggning OK',
  login_failure: 'Inloggning misslyckad',
  logout: 'Utloggning',
  upload_success: 'Uppladdning OK',
  upload_failure: 'Uppladdning misslyckad',
  file_delete: 'Fil raderad',
  file_archived: 'Fil arkiverad',
  file_archive_failure: 'Arkivering misslyckades',
  upload_hook_failure: 'Uppladdningshook misslyckades',
  folder_hooks_updated: 'Mappens hook-skript uppdaterades',
};

const ALL_EVENT_TYPES = Object.keys(EVENT_LABELS);

function formatDetails(details) {
  if (!details) return '–';
  const parts = [];
  if (details.filename || details.original_name) {
    parts.push(details.original_name || details.filename);
  }
  if (details.stored_filename && details.stored_filename !== details.filename) {
    parts.push(`(lagrat: ${details.stored_filename})`);
  }
  if (details.folder) parts.push(`mapp: ${details.folder}`);
  if (details.file_size) {
    const kb = Math.round(details.file_size / 1024);
    parts.push(`${kb} KB`);
  }
  if (details.mime_type) parts.push(details.mime_type);
  if (details.attempted_username) parts.push(`försökt: ${details.attempted_username}`);
  if (details.error) parts.push(`fel: ${details.error}`);
  return parts.join(' · ') || JSON.stringify(details);
}

function formatDate(ts) {
  if (!ts) return '–';
  const d = new Date(ts);
  return d.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'medium' });
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filterEventType, setFilterEventType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit };
      if (filterEventType) params.event_type = filterEventType;
      if (filterFrom) params.from = filterFrom;
      if (filterTo) params.to = filterTo + 'T23:59:59';
      const { data } = await logsAPI.getLogs(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setError('Det gick inte att hämta loggar.');
    } finally {
      setLoading(false);
    }
  }, [page, filterEventType, filterFrom, filterTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h6">Aktivitetsloggar</Typography>
        <Tooltip title="Uppdatera">
          <IconButton onClick={fetchLogs} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Händelsetyp</InputLabel>
          <Select
            value={filterEventType}
            label="Händelsetyp"
            onChange={(e) => { setFilterEventType(e.target.value); handleFilterChange(); }}
          >
            <MenuItem value=""><em>Alla</em></MenuItem>
            {ALL_EVENT_TYPES.map(t => (
              <MenuItem key={t} value={t}>{EVENT_LABELS[t]}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Från datum"
          type="date"
          value={filterFrom}
          onChange={(e) => { setFilterFrom(e.target.value); handleFilterChange(); }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          size="small"
          label="Till datum"
          type="date"
          value={filterTo}
          onChange={(e) => { setFilterTo(e.target.value); handleFilterChange(); }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
      </Stack>

      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      </Collapse>

      <Typography variant="body2" color="text.secondary" mb={1}>
        {total} poster totalt
      </Typography>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tid</TableCell>
              <TableCell>Händelse</TableCell>
              <TableCell>Användare</TableCell>
              <TableCell>IP</TableCell>
              <TableCell>Detaljer</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Inga poster hittades</Typography>
                </TableCell>
              </TableRow>
            ) : logs.map(log => (
              <TableRow key={log.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                  {formatDate(log.created_at)}
                </TableCell>
                <TableCell>
                  <Chip
                    label={EVENT_LABELS[log.event_type] || log.event_type}
                    color={EVENT_COLORS[log.event_type] || 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell sx={{ fontSize: '0.85rem' }}>
                  {log.username || '–'}
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  {log.ip_address || '–'}
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Tooltip title={formatDetails(log.details)} placement="top-start">
                    <span>{formatDetails(log.details)}</span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {pages > 1 && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Pagination
            count={pages}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
