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
  Grid,
  Chip
} from '@mui/material';
import { MusicNote, Close, Save } from '@mui/icons-material';
import { mp3TagsAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function Mp3TagsDialog({ open, onClose, file }) {
  const [tags, setTags] = useState({
    title: '',
    artist: '',
    album: '',
    year: '',
    comment: '',
    genre: '',
    trackNumber: '',
    bpm: '',
    composer: '',
    copyright: '',
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
        artist: '',
        album: '',
        year: '',
        comment: '',
        genre: '',
        trackNumber: '',
        bpm: '',
        composer: '',
        copyright: '',
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
              Grundläggande information
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Titel"
                  value={tags.title || ''}
                  onChange={handleChange('title')}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Artist"
                  value={tags.artist || ''}
                  onChange={handleChange('artist')}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Album"
                  value={tags.album || ''}
                  onChange={handleChange('album')}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="År"
                  value={tags.year || ''}
                  onChange={handleChange('year')}
                  variant="outlined"
                  placeholder="YYYY"
                />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 3 }}>
              Ytterligare information
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Genre"
                  value={tags.genre || ''}
                  onChange={handleChange('genre')}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Spårnummer"
                  value={tags.trackNumber || ''}
                  onChange={handleChange('trackNumber')}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Kompositör"
                  value={tags.composer || ''}
                  onChange={handleChange('composer')}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="BPM"
                  value={tags.bpm || ''}
                  onChange={handleChange('bpm')}
                  variant="outlined"
                  type="number"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Copyright"
                  value={tags.copyright || ''}
                  onChange={handleChange('copyright')}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Kommentar"
                  value={tags.comment || ''}
                  onChange={handleChange('comment')}
                  variant="outlined"
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
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
