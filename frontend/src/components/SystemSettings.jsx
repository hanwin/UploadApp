import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
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
  const [defaultSeqPathTemplate, setDefaultSeqPathTemplate] = useState('');
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
      </CardContent>
    </Card>
  );
}

export default SystemSettings;
