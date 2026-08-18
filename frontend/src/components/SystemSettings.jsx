import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  TextField,
  Divider
} from '@mui/material';
import { settingsAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function SystemSettings() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [defaultSeqPathTemplate, setDefaultSeqPathTemplate] = useState('');
  const { success, error: showError } = useToast();

  useEffect(() => {
    settingsAPI.get()
      .then((response) => setDefaultSeqPathTemplate(response.data?.defaultSeqPathTemplate || ''))
      .catch(() => showError('Kunde inte hämta seq-inställningar'));
  }, [showError]);

  const saveSeqSettings = async () => {
    try {
      const response = await settingsAPI.update({ defaultSeqPathTemplate });
      setDefaultSeqPathTemplate(response.data?.defaultSeqPathTemplate || '');
      success('Seq-inställningar sparade');
    } catch (error) {
      showError(error.response?.data?.error || 'Kunde inte spara seq-inställningar');
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

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Centrala inställningar
        </Typography>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Legacy seq-flöde
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Används endast i mappar där upload.sh saknas. Mappens .tmpl-fil styr seq-innehållet.
        </Typography>
        <TextField
          fullWidth
          margin="dense"
          label="Standard sökväg i seq-fil"
          value={defaultSeqPathTemplate}
          onChange={(event) => setDefaultSeqPathTemplate(event.target.value)}
          helperText={'Exempel: Y:\\audio_upload\\{foldername}'}
        />
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={saveSeqSettings}>Spara seq-inställning</Button>
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
