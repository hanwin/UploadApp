import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Grid,
  Paper,
  ListItemButton,
  ListItemIcon,
  Tooltip
} from '@mui/material';
import { Delete, Add, Folder, FolderOpen, Edit } from '@mui/icons-material';
import { folderAPI } from '../services/api';
import ConfirmModal from './ConfirmModal';
import { useToast } from '../contexts/ToastContext';
import AudioList from './AudioList';

function FolderManagement({ user }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderStandardTagTitle, setNewFolderStandardTagTitle] = useState('');
  const [newFolderStandardTagArtist, setNewFolderStandardTagArtist] = useState('');
  const [editDialog, setEditDialog] = useState({ open: false, folder: null, standardTagTitle: '', standardTagArtist: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showFiles, setShowFiles] = useState(false);
  const { success, error: showError } = useToast();

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const response = await folderAPI.getAll();
      const sorted = [...response.data].sort((a, b) =>
        (a.original_name || a.disk_name).localeCompare(b.original_name || b.disk_name, 'sv')
      );
      setFolders(sorted);
    } catch (err) {
      showError('Kunde inte ladda mappar');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      showError('Mappnamn får inte vara tomt');
      return;
    }

    try {
      await folderAPI.create({
        name: newFolderName.trim(),
        standardTagTitle: newFolderStandardTagTitle,
        standardTagArtist: newFolderStandardTagArtist
      });
      success(`Mapp "${newFolderName}" skapad!`);
      setNewFolderName('');
      setNewFolderStandardTagTitle('');
      setNewFolderStandardTagArtist('');
      setOpenDialog(false);
      loadFolders();
    } catch (err) {
      showError(err.response?.data?.error || 'Kunde inte skapa mapp');
    }
  };

  const handleDeleteFolder = async () => {
    if (!confirmDelete) return;

    try {
      await folderAPI.delete(confirmDelete.id);
      success(`Mapp "${confirmDelete.original_name || confirmDelete.disk_name}" borttagen!`);
      setFolders(folders.filter(f => f.id !== confirmDelete.id));
    } catch (err) {
      showError(err.response?.data?.error || 'Kunde inte ta bort mapp');
    } finally {
      setConfirmDelete(null);
    }
  };

  const openEditDialog = (folder) => {
    setEditDialog({
      open: true,
      folder,
      standardTagTitle: folder.default_mp3_title || '',
      standardTagArtist: folder.default_mp3_artist || ''
    });
  };

  const handleUpdateFolder = async () => {
    if (!editDialog.folder) return;

    try {
      await folderAPI.update(editDialog.folder.id, {
        standardTagTitle: editDialog.standardTagTitle,
        standardTagArtist: editDialog.standardTagArtist
      });
      success('Mapp uppdaterad!');
      setEditDialog({ open: false, folder: null, standardTagTitle: '', standardTagArtist: '' });
      loadFolders();
    } catch (err) {
      showError(err.response?.data?.error || 'Kunde inte uppdatera mapp');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleFolderClick = (folder) => {
    setSelectedFolder(folder.disk_name);
    setShowFiles(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // If showing files for a selected folder
  if (showFiles && selectedFolder) {
    return (
      <Box>
        <Button 
          onClick={() => setShowFiles(false)}
          startIcon={<Folder />}
          sx={{ mb: 2 }}
        >
          Tillbaka till mappar
        </Button>
        <AudioList 
          user={{ ...user, folders: [selectedFolder] }}
          refreshTrigger={0}
          onUploadSuccess={() => {}}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
      {/* Folders list */}
      <Card sx={{ flexGrow: 1 }}>
        <CardContent>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', 
            alignItems: { xs: 'stretch', sm: 'center' }, 
            mb: 3,
            gap: { xs: 2, sm: 0 }
          }}>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, order: { xs: 1, sm: 0 } }}>
              <Folder /> Mappar
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpenDialog(true)}
              sx={{ order: { xs: 0, sm: 1 } }}
            >
              Ny mapp
            </Button>
          </Box>

          {folders.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              <Folder sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
              <Typography variant="body1">
                Inga mappar finns än
              </Typography>
            </Box>
          ) : (
            <List sx={{ pt: 0 }}>
              {folders.map((folder) => (
                <ListItemButton
                  key={folder.id}
                  onClick={() => handleFolderClick(folder)}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    mb: 1,
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <ListItemIcon>
                    <Folder sx={{ color: 'primary.main', fontSize: 40 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={folder.original_name || folder.disk_name}
                    primaryTypographyProps={{ variant: 'body1', fontWeight: 'medium' }}
                    secondary={
                      (folder.default_mp3_title || folder.default_mp3_artist)
                        ? `Standardtag MP3 - Title: ${folder.default_mp3_title || '-'} | Artist: ${folder.default_mp3_artist || '-'}`
                        : null
                    }
                  />
                  <Tooltip title="Redigera standardtag MP3">
                    <IconButton
                      edge="end"
                      color="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(folder);
                      }}
                      aria-label="edit"
                      sx={{ ml: 1 }}
                    >
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  {(folder.original_name || folder.disk_name) !== 'Standard' && (
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(folder);
                      }}
                      aria-label="delete"
                      sx={{ ml: 2 }}
                    >
                      <Delete />
                    </IconButton>
                  )}
                </ListItemButton>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Create Folder Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setNewFolderStandardTagTitle('');
          setNewFolderStandardTagArtist('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Skapa ny mapp</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Mappnamn"
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateFolder();
              }
            }}
          />
          <TextField
            margin="dense"
            label="Standardtag MP3 title"
            fullWidth
            value={newFolderStandardTagTitle}
            onChange={(e) => setNewFolderStandardTagTitle(e.target.value)}
            helperText="Använd {filename} för filnamn och {folder} för mappens fullständiga namn"
          />
          <TextField
            margin="dense"
            label="Standardtag MP3 artist"
            fullWidth
            value={newFolderStandardTagArtist}
            onChange={(e) => setNewFolderStandardTagArtist(e.target.value)}
            helperText="Lämna tomt för automatisk artist = mappnamn"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenDialog(false);
              setNewFolderStandardTagTitle('');
              setNewFolderStandardTagArtist('');
            }}
          >
            Avbryt
          </Button>
          <Button onClick={handleCreateFolder} variant="contained">
            Skapa
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, folder: null, standardTagTitle: '', standardTagArtist: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>Redigera mapp</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Standardtag MP3 title"
            fullWidth
            value={editDialog.standardTagTitle}
            onChange={(e) => setEditDialog((prev) => ({ ...prev, standardTagTitle: e.target.value }))}
            helperText="Använd {filename} för filnamn och {folder} för mappens fullständiga namn"
          />
          <TextField
            margin="dense"
            label="Standardtag MP3 artist"
            fullWidth
            value={editDialog.standardTagArtist}
            onChange={(e) => setEditDialog((prev) => ({ ...prev, standardTagArtist: e.target.value }))}
            helperText="Lämna tomt för automatisk artist = mappnamn"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, folder: null, standardTagTitle: '', standardTagArtist: '' })}>Avbryt</Button>
          <Button onClick={handleUpdateFolder} variant="contained">
            Spara
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteFolder}
        message={`Är du säker på att du vill ta bort mappen "${confirmDelete?.original_name || confirmDelete?.disk_name}"? Detta går endast om mappen är tom.`}
        title="Ta bort mapp"
      />
    </Box>
  );
}

export default FolderManagement;
