import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  CircularProgress,
  Typography,
  Chip
} from '@mui/material';
import { MusicNote, Close, Save } from '@mui/icons-material';
import { mp3TagsAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function Mp3TagsDialog({ open, onClose, file }) {
  const [tags, setTags] = useState({
    title: '',
    artist: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { success, error: showError } = useToast();

  useEffect(() => {
    if (open && file) {
      loadTags();
    }
  }, [open, file]);

  const loadTags = async () => {
    setLoading(true);
    try {
      const response = await mp3TagsAPI.read(file.id);
      setTags(response.data.tags || {});
    } catch (err) {
      showError(err.response?.data?.error || 'Kunde inte läsa MP3-taggar');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (event) => {
    setTags({
      ...tags,
      [field]: event.target.value
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await mp3TagsAPI.write(file.id, tags);
      success('MP3-taggar uppdaterade!');
      onClose();
    } catch (err) {
      showError(err.response?.data?.error || 'Kunde inte spara MP3-taggar');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAll = async () => {
    if (!window.confirm('Är du säker på att du vill ta bort alla taggar?')) {
      return;
    }
    
    setSaving(true);
    try {
      await mp3TagsAPI.remove(file.id);
      setTags({
        title: '',
        artist: ''
      });
      success('Alla taggar borttagna!');
    } catch (err) {
      showError(err.response?.data?.error || 'Kunde inte ta bort taggar');
    } finally {
      setSaving(false);
    }
  };

  if (!file) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MusicNote color="primary" />
        Redigera MP3-taggar
        <Chip 
          label={file.original_name} 
          size="small" 
          sx={{ ml: 2 }}
        />
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ pt: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Title och artist
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
                <TextField
                  fullWidth
                  label="Titel"
                  value={tags.title || ''}
                  onChange={handleChange('title')}
                  variant="outlined"
                />
              
                <TextField
                  fullWidth
                  label="Artist"
                  value={tags.artist || ''}
                  onChange={handleChange('artist')}
                  variant="outlined"
                />
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button
          onClick={handleRemoveAll}
          color="error"
          disabled={saving || loading}
          variant="outlined"
        >
          Ta bort alla taggar
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            onClick={onClose} 
            disabled={saving}
            startIcon={<Close />}
          >
            Avbryt
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained"
            disabled={saving || loading}
            startIcon={saving ? <CircularProgress size={20} /> : <Save />}
          >
            {saving ? 'Sparar...' : 'Spara'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default Mp3TagsDialog;
