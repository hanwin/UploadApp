import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  TextField,
  Typography
} from '@mui/material';
import { settingsAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const DEFAULT_SEQ_PATH_EXAMPLE = ['Y:', 'audio_upload', '{foldername}'].join('\\');

function normalizePathSeparators(value) {
  const input = String(value || '');
  const uncPrefixMatch = input.match(/^(\\\\|\/\/)/);
  const uncPrefix = uncPrefixMatch ? uncPrefixMatch[0] : '';
  const body = uncPrefix ? input.slice(uncPrefix.length) : input;

  return `${uncPrefix}${body.replace(/[\\/]{2,}/g, (match) => match[0])}`;
}

function sanitizeDefaultSeqPath(value) {
  return normalizePathSeparators(String(value || '').replace(/[\\/]?\{filename\}\s*$/i, ''));
}

function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [defaultSeqPathTemplate, setDefaultSeqPathTemplate] = useState('');
  const [syncResult, setSyncResult] = useState(null);
  const { success, error: showError } = useToast();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await settingsAPI.get();
        setDefaultSeqPathTemplate(response.data?.defaultSeqPathTemplate || '');
      } catch (error) {
        showError('Kunde inte hämta inställningar');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [showError]);

  const handleSave = async () => {
    try {
      const payload = {
        defaultSeqPathTemplate: sanitizeDefaultSeqPath(defaultSeqPathTemplate)
      };
      const response = await settingsAPI.update(payload);
      setDefaultSeqPathTemplate(response.data?.defaultSeqPathTemplate || '');
      success('Inställningar sparade');
    } catch (error) {
      showError(error.response?.data?.error || 'Kunde inte spara inställningar');
    }
  };

  const handleSyncStorage = async (dryRun) => {
    try {
      setSyncing(true);
      const response = await settingsAPI.syncStorage(dryRun);
      setSyncResult(response.data?.summary || null);
      success(dryRun ? 'Torrkörning klar' : 'Synk slutförd');
    } catch (error) {
      showError(error.response?.data?.error || 'Kunde inte synka lagring mot databas');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Centrala inställningar
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Detta värde används globalt för seq file0-mall vid uppladdning.
        </Typography>

        <TextField
          fullWidth
          margin="dense"
          label="Default file0-mall för seq"
          value={defaultSeqPathTemplate}
          onChange={(e) => setDefaultSeqPathTemplate(sanitizeDefaultSeqPath(e.target.value))}
          helperText={`Exempel: ${DEFAULT_SEQ_PATH_EXAMPLE}`}
        />

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={handleSave}>
            Spara
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" sx={{ mb: 1 }}>
          Synka filer och mappar
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Jämför innehållet på disk med databasen och synka skillnader för både filer och mappar.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            disabled={syncing}
            onClick={() => handleSyncStorage(true)}
          >
            Torrkörning
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={syncing}
            onClick={() => handleSyncStorage(false)}
          >
            Synka nu
          </Button>
        </Box>

        {syncing && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Synkar lagring och databas...
            </Typography>
          </Box>
        )}

        {syncResult && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">Kontrollerade filer: {syncResult.checkedRows}</Typography>
            <Typography variant="body2">Saknade filer: {syncResult.missingFiles}</Typography>
            <Typography variant="body2">Dubbletter i DB: {syncResult.duplicateFileRows}</Typography>
            <Typography variant="body2">Raderade filrader: {syncResult.deletedFileRows}</Typography>
            <Typography variant="body2">Mappar på disk: {syncResult.diskFolders}</Typography>
            <Typography variant="body2">Mappar i DB: {syncResult.dbFolders}</Typography>
            <Typography variant="body2">Nya mappar i DB: {syncResult.insertedFolders}</Typography>
            <Typography variant="body2">Raderade mappar i DB: {syncResult.deletedFolders}</Typography>
            <Typography variant="body2">Skippade mappraderingar: {syncResult.skippedFolderDeletes}</Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default SystemSettings;
