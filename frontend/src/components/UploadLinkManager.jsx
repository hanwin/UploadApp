import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import { uploadLinkAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('sv-SE');
}

function UploadLinkManager() {
  const [validDays, setValidDays] = useState(1);
  const [creating, setCreating] = useState(false);
  const [latestLink, setLatestLink] = useState(null);
  const [links, setLinks] = useState([]);
  const { success, error: showError } = useToast();

  const sortedLinks = useMemo(() => {
    return [...links].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [links]);

  const loadLinks = async () => {
    try {
      const response = await uploadLinkAPI.getMine();
      setLinks(response.data || []);
    } catch (error) {
      showError('Kunde inte hämta uppladdningslänkar');
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const response = await uploadLinkAPI.create(validDays);
      setLatestLink(response.data);
      success('Uppladdningslänk skapad');
      await loadLinks();
    } catch (error) {
      showError(error.response?.data?.error || 'Kunde inte skapa uppladdningslänk');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      success('Länk kopierad');
    } catch (error) {
      showError('Kunde inte kopiera länken');
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon /> Dela uppladdningslänk
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Skapa en tidsbegränsad länk (1-7 dagar) som någon annan kan använda för att ladda upp en fil.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="valid-days-label">Giltig i</InputLabel>
            <Select
              labelId="valid-days-label"
              label="Giltig i"
              value={validDays}
              onChange={(e) => setValidDays(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <MenuItem key={day} value={day}>{day} {day === 1 ? 'dag' : 'dagar'}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            Skapa länk
          </Button>
        </Box>

        {latestLink?.uploadUrl && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <TextField
              label="Senast skapad länk"
              value={latestLink.uploadUrl}
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
            />
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => copyToClipboard(latestLink.uploadUrl)}
            >
              Kopiera
            </Button>
          </Box>
        )}

        {sortedLinks.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Senaste länkar</Typography>
            {sortedLinks.slice(0, 5).map((link) => (
              <Typography key={link.id} variant="body2" color="text.secondary">
                Skapad: {formatDateTime(link.created_at)} | Giltig till: {formatDateTime(link.expires_at)} | Använd: {link.use_count || 0} gånger
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default UploadLinkManager;
