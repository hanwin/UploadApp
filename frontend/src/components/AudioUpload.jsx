import { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  Button,
  Typography,
  Box,
  LinearProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { CloudUpload, AudioFile, Cancel } from '@mui/icons-material';
import { audioAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function AudioUpload({ onUploadSuccess, user, selectedFolder, impersonatedUserId }) {
  const [fileExistsDialog, setFileExistsDialog] = useState({ open: false, file: null, shouldProcess: false, shouldDeleteOriginal: false });
  const [overwrite, setOverwrite] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [deleteOriginal, setDeleteOriginal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const abortControllerRef = useRef(null);
  const { success, error: showError } = useToast();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // Get impersonatedUserId from prop or localStorage as fallback
  const getEffectiveImpersonatedUserId = () => {
    if (impersonatedUserId) return impersonatedUserId;
    
    // Fallback: check localStorage
    const savedImpersonation = localStorage.getItem('impersonatedUser');
    if (savedImpersonation) {
      try {
        const impersonatedUser = JSON.parse(savedImpersonation);
        return impersonatedUser.id;
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const validateAndUpload = async (selectedFile, shouldProcess, shouldDeleteOriginal, overwriteFile = false, customName = null) => {
    if (!selectedFile) return;

    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav'];
    const validExtensions = ['.mp3', '.wav'];
    const fileExt = '.' + selectedFile.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExt)) {
      showError('Endast MP3 och WAV filer är tillåtna');
      return;
    }

    if (selectedFile.size > 4 * 1024 * 1024 * 1024) {
      showError('Filen får max vara 4GB');
      return;
    }

    setFile(selectedFile);
    setUploading(true);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    // Determine which folder to use (must be disk_name)
    let folderToUse = selectedFolder || (user?.folders && user.folders[0]);
    // If folder object, use disk_name
    if (typeof folderToUse === 'object' && folderToUse !== null) {
      folderToUse = folderToUse.disk_name;
    }
    
    // Get effective impersonatedUserId (from prop or localStorage)
    const effectiveImpersonatedUserId = getEffectiveImpersonatedUserId();

    if (!folderToUse) {
      showError('Ingen mapp vald');
      setUploading(false);
      return;
    }

    const formData = new FormData();
    // If user chose to rename, use customName
    let uploadFile = selectedFile;
    if (customName) {
      // Create a new File object with the new name
      uploadFile = new File([selectedFile], customName, { type: selectedFile.type });
    }
    formData.append('audio', uploadFile);
    
    // Add processing flags
    formData.append('processAudio', shouldProcess ? 'true' : 'false');
    formData.append('deleteOriginal', shouldDeleteOriginal ? 'true' : 'false');

    try {
      // Send folder as query parameter instead of in formData
      // Use effectiveImpersonatedUserId instead of the prop
      await audioAPI.upload(formData, folderToUse, effectiveImpersonatedUserId, {
        signal: abortControllerRef.current.signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
        headers: overwriteFile ? { 'X-Overwrite': 'true' } : {},
      });

      if (shouldProcess && uploadFile.name.toLowerCase().endsWith('.wav')) {
        if (shouldDeleteOriginal) {
          success('Fil uppladdad! Processningen startar. Original raderas efter lyckad processning.');
        } else {
          success('Fil uppladdad! Processningen startar i bakgrunden.');
        }
      } else {
        success('Fil uppladdad!');
      }

      setFile(null);
      onUploadSuccess();
    } catch (err) {
      // Special handling for file exists error
      const existsMatch = err.response?.data?.error?.match?.(/^FILE_EXISTS:(.+)$/);
      if (existsMatch) {
        setFileExistsDialog({
          open: true,
          file: selectedFile,
          shouldProcess,
          shouldDeleteOriginal
        });
        setUploading(false);
        return;
      }
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        try {
          await audioAPI.cleanupAborted(folderToUse, uploadFile.name);
        } catch (cleanupErr) {
          // Ignore cleanup errors here; user already canceled the upload.
        }
        showError('Uppladdning avbruten');
        window.location.reload();
        return;
      } else {
        showError(err.response?.data?.error || 'Uppladdning misslyckades');
      }
      setFile(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      abortControllerRef.current = null;
    }
  };

  // Handle overwrite or rename dialog actions (must be top-level for Dialog)
  const handleFileExistsOverwrite = () => {
    const { file: existingFile, shouldProcess, shouldDeleteOriginal } = fileExistsDialog;
    setFileExistsDialog({ open: false, file: null, shouldProcess: false, shouldDeleteOriginal: false });
    // Retry upload with overwrite header
    validateAndUpload(existingFile, shouldProcess, shouldDeleteOriginal, true);
  };

  const handleFileExistsRename = (newName) => {
    const { file: existingFile, shouldProcess, shouldDeleteOriginal } = fileExistsDialog;
    setFileExistsDialog({ open: false, file: null, shouldProcess: false, shouldDeleteOriginal: false });
    // Retry upload with new name
    validateAndUpload(existingFile, shouldProcess, shouldDeleteOriginal, false, newName);
  };

  const handleFileExistsCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setFileExistsDialog({ open: false, file: null, shouldProcess: false, shouldDeleteOriginal: false });
    setFile(null);
    setUploading(false);
    setUploadProgress(0);
    window.location.reload();
  };

  const handleFileSelected = (selectedFile) => {
    if (!selectedFile) return;

    // Check if it's a WAV file
    const fileName = selectedFile.name.toLowerCase();
    const isWavFile = fileName.endsWith('.wav');

    if (isWavFile) {
      // Show dialog to ask about processing
      setPendingFile(selectedFile);
      setShowProcessDialog(true);
    } else {
      // MP3 files - just upload directly
      validateAndUpload(selectedFile, false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    handleFileSelected(selectedFile);
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleProcessDialogYes = () => {
    setShowProcessDialog(false);
    validateAndUpload(pendingFile, true, deleteOriginal);
    setPendingFile(null);
    setDeleteOriginal(false); // Reset for next upload
  };

  const handleProcessDialogNo = () => {
    setShowProcessDialog(false);
    validateAndUpload(pendingFile, false, false);
    setPendingFile(null);
    setDeleteOriginal(false); // Reset for next upload
  };

  const handleProcessDialogCancel = () => {
    setShowProcessDialog(false);
    setPendingFile(null);
    setDeleteOriginal(false); // Reset for next upload
  };

  // Helper component for rename input
  function RenameFileInputDialog({ onRename, originalName }) {
    const [newName, setNewName] = useState(originalName || '');
    return (
      <Box component="span">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <Button variant="outlined" onClick={() => onRename(newName)} disabled={!newName || newName === originalName}>
          Byt namn
        </Button>
      </Box>
    );
  }

  return (
    <>
      {/* File exists dialog */}
      <Dialog open={fileExistsDialog.open} onClose={handleFileExistsCancel}>
        <DialogTitle>Filen finns redan</DialogTitle>
        <DialogContent>
          <Typography>En fil med samma namn finns redan i mappen. Vill du skriva över den gamla eller byta namn?</Typography>
          <Box mt={2}>
            <Button variant="contained" color="primary" onClick={handleFileExistsOverwrite} sx={{ mr: 2 }}>Skriv över</Button>
            <RenameFileInputDialog onRename={handleFileExistsRename} originalName={fileExistsDialog.file?.name} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFileExistsCancel} color="inherit">Avbryt</Button>
        </DialogActions>
      </Dialog>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography 
            variant="h5" 
            gutterBottom 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              fontSize: { xs: '1.25rem', sm: '1.5rem' } 
          }}
        >
          <CloudUpload /> Ladda upp ljudfil
        </Typography>

        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            position: 'relative',
            borderStyle: 'dashed',
            borderWidth: 2,
            borderColor: dragActive ? 'primary.main' : 'divider',
            borderRadius: 2,
            py: { xs: 3, sm: 4 },
            px: 2,
            textAlign: 'center',
            bgcolor: dragActive ? 'action.hover' : 'background.paper',
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: uploading ? 'divider' : 'primary.main',
              bgcolor: uploading ? 'background.paper' : 'action.hover'
            }
          }}
        >
          <input
            type="file"
            hidden
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            onChange={handleFileChange}
            disabled={uploading}
            id="audio-file-input"
          />
          <label 
            htmlFor="audio-file-input" 
            style={{ 
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'block',
              width: '100%'
            }}
          >
            {uploading ? (
              <>
                <AudioFile sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="body1" gutterBottom>
                  Laddar upp: {file?.name}
                </Typography>
                <LinearProgress 
                  variant={uploadProgress > 0 ? 'determinate' : 'indeterminate'}
                  value={uploadProgress}
                  sx={{ my: 2, mx: 'auto', maxWidth: 400 }} 
                />
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  {uploadProgress > 0 
                    ? `${uploadProgress}% — ${(file.size / 1024 / 1024).toFixed(0)} MB`
                    : file && `${(file.size / 1024 / 1024).toFixed(2)} MB`
                  }
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<Cancel />}
                  onClick={(e) => {
                    e.preventDefault();
                    handleAbort();
                  }}
                  sx={{ mt: 1 }}
                >
                  Avbryt uppladdning
                </Button>
              </>
            ) : file ? (
              <>
                <AudioFile sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                <Typography variant="body1" gutterBottom>
                  {file.name}
                </Typography>
                <Chip 
                  label={`${(file.size / 1024 / 1024).toFixed(2)} MB`} 
                  size="small" 
                  color="success"
                />
              </>
            ) : (
              <>
                <CloudUpload sx={{ fontSize: 48, color: 'action.active', mb: 1 }} />
                <Typography variant="body1" gutterBottom>
                  {dragActive ? 'Släpp filen här' : 'Klicka eller dra och släpp en ljudfil här'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  MP3 eller WAV (max 4GB)
                </Typography>
              </>
            )}
          </label>
        </Box>

        {/* Processing Dialog */}
        <Dialog open={showProcessDialog} onClose={handleProcessDialogCancel}>
          <DialogTitle>Processa ljudfil för radio?</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              <strong>Fil:</strong> {pendingFile?.name}
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Processning inkluderar:</strong>
              </Typography>
              <Typography variant="body2" component="div">
                • Ljudnivåjämning (EBU R128 standard för radio)
                <br />
                • Dynamisk kompression för jämnare ljud mellan tal och musik
                <br />
                • Konvertering till MP3 (192 kbps)
              </Typography>
            </Alert>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteOriginal}
                  onChange={(e) => setDeleteOriginal(e.target.checked)}
                  color="primary"
                />
              }
              label="Ta bort original WAV-fil vid lyckad processning"
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleProcessDialogCancel}>
              Avbryt
            </Button>
            <Button onClick={handleProcessDialogNo} variant="outlined">
              Nej, ladda endast upp
            </Button>
            <Button onClick={handleProcessDialogYes} variant="contained" color="primary">
              Ja, processa
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
    </>
  );
}

export default AudioUpload;
