import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  IconButton,
  Chip,
  CircularProgress,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Paper,
  LinearProgress,
  Button
} from '@mui/material';
import { Delete, AudioFile, Person, Folder as FolderIcon, Schedule, CalendarMonth, MusicNote } from '@mui/icons-material';
import { audioAPI, folderAPI } from '../services/api';
import ConfirmModal from './ConfirmModal';
import AudioUpload from './AudioUpload';
import AudioPlayer from './AudioPlayer';
import ScheduleDialog from './ScheduleDialog';
import Mp3TagsDialog from './Mp3TagsDialog';
import { useToast } from '../contexts/ToastContext';
import { io } from 'socket.io-client';

function AudioList({ user, refreshTrigger, onUploadSuccess, impersonatedUserId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [scheduleDialog, setScheduleDialog] = useState(null);
  const [mp3TagsDialog, setMp3TagsDialog] = useState(null);
  const [folders, setFolders] = useState([]);
  const { success, error: showError } = useToast();
  const socketRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  // Read folder from URL path: /files/folderName or /folder/folderName
  const getFolderFromUrl = () => {
    const match = location.pathname.match(/^\/(?:files|folder)\/(.+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };
  const selectedFolder = getFolderFromUrl();

  const setSelectedFolder = (diskName) => {
    if (diskName) {
      navigate(`/files/${encodeURIComponent(diskName)}`);
    } else {
      navigate('/files');
    }
  };

  useEffect(() => {
    if (isAdmin && !impersonatedUserId) {
      loadFolders();
    } else if (impersonatedUserId && user.folders?.length > 0) {
      // When impersonating, set selected folder to the impersonated user's first folder
      if (!selectedFolder) setSelectedFolder(user.folders[0]);
    } else if (!isAdmin && user.folders?.length > 0) {
      // Regular user - set first folder if none selected in URL
      if (!selectedFolder) {
        setSelectedFolder(user.folders[0]);
      }
    }
    loadFiles();
  }, [refreshTrigger, user, impersonatedUserId]);

  // WebSocket effect
  useEffect(() => {
    // Connect to WebSocket server - use same origin as the page
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Socket.IO connected
    });

    socket.on('audioProcessing', (data) => {
      // Update file status in state without reloading
      setFiles(prevFiles => prevFiles.map(f => 
        f.id === data.fileId 
          ? { ...f, processing_status: data.status, processing_progress: 0 }
          : f
      ));
    });
    
    socket.on('audioProcessingProgress', (data) => {
      // Update progress in state
      setFiles(prevFiles => prevFiles.map(f => 
        f.id === data.fileId 
          ? { 
              ...f, 
              processing_progress: data.progress,
              estimated_seconds_left: data.estimatedSecondsLeft 
            }
          : f
      ));
    });

    socket.on('audioProcessingComplete', (data) => {
      success(`Processning av "${data.originalName}" klar!`);
      
      // Update original file status to completed
      if (data.originalFileId) {
        setFiles(prevFiles => prevFiles.map(f => 
          f.id === data.originalFileId 
            ? { ...f, processing_status: 'completed', processing_progress: 100 }
            : f
        ));
      }
      
      // Reload files to get the new processed file
      loadFiles();
    });

    socket.on('audioProcessingFailed', (data) => {
      showError(`Processning av fil misslyckades`);
      // Update status in state
      setFiles(prevFiles => prevFiles.map(f => 
        f.id === data.fileId 
          ? { ...f, processing_status: 'failed', processing_progress: 0 }
          : f
      ));
    });

    socket.on('disconnect', () => {
      // Socket.IO disconnected
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  const loadFolders = async () => {
    try {
      const response = await folderAPI.getAll();
      setFolders(response.data);
      // Set first folder as default selected (use disk_name)
      if (response.data.length > 0 && !selectedFolder) {
        setSelectedFolder(response.data[0].disk_name);
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      let response;
      
      // Get impersonatedUserId from prop or localStorage as fallback
      let effectiveImpersonatedUserId = impersonatedUserId;
      if (!effectiveImpersonatedUserId) {
        const savedImpersonation = localStorage.getItem('impersonatedUser');
        if (savedImpersonation) {
          try {
            const impersonatedUser = JSON.parse(savedImpersonation);
            effectiveImpersonatedUserId = impersonatedUser.id;
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      if (effectiveImpersonatedUserId) {
        // When impersonating, get specific user's files
        response = await audioAPI.getUserFiles(effectiveImpersonatedUserId);
      } else if (isAdmin) {
        // Admin viewing all files
        response = await audioAPI.getAllFiles();
      } else {
        // Regular user viewing their own files
        response = await audioAPI.getMyFiles();
      }
      setFiles(response.data);
    } catch (err) {
      showError('Kunde inte ladda filer');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      await audioAPI.delete(confirmDelete.id);
      setFiles(files.filter(f => f.id !== confirmDelete.id));
      success(`"${confirmDelete.original_name}" borttagen!`);
    } catch (err) {
      showError('Kunde inte ta bort filen');
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleScheduleClick = (file) => {
    setScheduleDialog(file);
  };

  const handleSchedule = async (fileId, broadcastTime) => {
    try {
      await audioAPI.updateBroadcastTime(fileId, broadcastTime);
      success(broadcastTime ? 'Sändning schemalagd!' : 'Schema borttaget!');
      loadFiles();
    } catch (err) {
      showError('Kunde inte uppdatera schema');
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

  const formatSize = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const filteredFiles = selectedFolder 
    ? files.filter(f => f.folder === selectedFolder)
    : files;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, height: '100%' }}>
      {/* Sidebar with folders */}
      {(isAdmin || (user.folders && user.folders.length > 1)) && (
        <Paper 
          elevation={2} 
          sx={{ 
            width: { xs: '100%', md: 240 }, 
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            height: 'fit-content',
            order: 0
          }}
        >
          <List sx={{ flexGrow: 1, pt: 0 }}>
            {(isAdmin 
              ? folders.map((folder) => ({ id: folder.id, disk_name: folder.disk_name, original_name: folder.original_name }))
              : (user.folders || []).map((disk_name, i) => {
                  const folderObj = folders.find(f => f.disk_name === disk_name);
                  return {
                    id: `uf-${i}`,
                    disk_name,
                    original_name: folderObj ? folderObj.original_name : disk_name
                  };
                })
            ).map((folder) => (
              <ListItemButton
                key={folder.id}
                selected={selectedFolder === folder.disk_name}
                onClick={() => setSelectedFolder(folder.disk_name)}
              >
                <ListItemIcon>
                  <FolderIcon color={selectedFolder === folder.disk_name ? 'primary' : 'inherit'} />
                </ListItemIcon>
                <ListItemText primary={folder.original_name} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}

      {/* Main content area */}
      <Card sx={{ flexGrow: 1, order: 1 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AudioFile /> Ljudfiler - {selectedFolder || (user.folders && user.folders[0]) || ''}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {filteredFiles.length} {filteredFiles.length === 1 ? 'fil' : 'filer'} i denna mapp
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* Upload section - only show if folder is available */}
          {(selectedFolder || (user.folders && user.folders.length > 0)) ? (
            <Box sx={{ mb: 3 }}>
              <AudioUpload 
                user={user} 
                onUploadSuccess={onUploadSuccess}
                selectedFolder={selectedFolder}
                impersonatedUserId={impersonatedUserId}
              />
            </Box>
          ) : isAdmin && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" color="info.contrastText">
                📁 Välj en mapp från sidopanelen eller gå till "Mappar" → "Visa filer" för att ladda upp filer
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

        {filteredFiles.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <AudioFile sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
            <Typography variant="body1">
              {isAdmin ? 'Inga filer uppladdade än' : 'Du har inte laddat upp några filer än'}
            </Typography>
          </Box>
        ) : (
          <List>
            {filteredFiles.map((file, index) => (
              <ListItem
                key={file.id}
                sx={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 2,
                  p: 2,
                  '&:last-child': { mb: 0 }
                }}
              >
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'flex-start' },
                  gap: { xs: 1, sm: 0 },
                  mb: 2 
                }}>
                  <AudioFile sx={{ 
                    mr: { xs: 0, sm: 2 }, 
                    mt: 0.5, 
                    color: 'primary.main',
                    display: { xs: 'none', sm: 'block' }
                  }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                      {file.original_name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                      <Chip label={formatSize(file.file_size)} size="small" />
                      <Chip label={formatDate(file.uploaded_at)} size="small" variant="outlined" />
                      {file.is_processed_version && (
                        <Chip label="Processad" size="small" color="success" />
                      )}
                      {file.processing_status === 'pending' && (
                        <Chip label="Väntar på processning..." size="small" color="info" />
                      )}
                      {file.processing_status === 'processing' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 200 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label="Processas..." size="small" color="warning" />
                            {file.processing_progress > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                {file.processing_progress}%
                                {file.estimated_seconds_left && file.estimated_seconds_left > 0 && (
                                  <> • ~{Math.ceil(file.estimated_seconds_left / 60)} min kvar</>
                                )}
                              </Typography>
                            )}
                          </Box>
                          {file.processing_progress > 0 && (
                            <LinearProgress 
                              variant="determinate" 
                              value={file.processing_progress} 
                              sx={{ height: 6, borderRadius: 1 }}
                            />
                          )}
                        </Box>
                      )}
                      {file.processing_status === 'completed' && file.processed_file_id && (
                        <Chip label="Processad version tillgänglig" size="small" color="success" />
                      )}
                      {file.processing_status === 'failed' && (
                        <Chip label="Processning misslyckades" size="small" color="error" />
                      )}
                      {file.broadcast_time && (
                        <Chip 
                          icon={<CalendarMonth />}
                          label={`Sänds: ${new Date(file.broadcast_time).toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                          size="small" 
                          color="warning"
                          sx={{ fontWeight: 'bold' }}
                        />
                      )}
                    </Box>
                    {isAdmin && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                        <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                          {file.username} ({file.email})
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignSelf: { xs: 'flex-end', sm: 'flex-start' } }}>
                    {file.filename?.toLowerCase().endsWith('.mp3') && (
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => setMp3TagsDialog(file)}
                        startIcon={<MusicNote />}
                        size="small"
                      >
                        Taggar
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => handleScheduleClick(file)}
                      startIcon={<Schedule />}
                      size="small"
                    >
                      Schemalägg
                    </Button>
                    <IconButton
                      color="error"
                      onClick={() => setConfirmDelete(file)}
                      aria-label="delete"
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </Box>

                <AudioPlayer 
                  src={`${audioAPI.getStreamUrl(file.id)}?token=${localStorage.getItem('token')}`}
                />
              </ListItem>
            ))}
          </List>
        )}

        <ConfirmModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
          message={`Är du säker på att du vill ta bort "${confirmDelete?.original_name}"?`}
          title="Ta bort fil"
        />

        <ScheduleDialog
          open={!!scheduleDialog}
          onClose={() => setScheduleDialog(null)}
          onSchedule={(broadcastTime) => {
            handleSchedule(scheduleDialog.id, broadcastTime);
            setScheduleDialog(null);
          }}
          currentSchedule={scheduleDialog?.broadcast_time}
        />

        <Mp3TagsDialog
          open={!!mp3TagsDialog}
          onClose={() => setMp3TagsDialog(null)}
          file={mp3TagsDialog}
        />
      </CardContent>
    </Card>
    </Box>
  );
}

export default AudioList;
