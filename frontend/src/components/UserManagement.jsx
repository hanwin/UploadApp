import { useState, useEffect } from 'react';
import { validatePassword } from '../utils/passwordValidator';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
  Collapse,
  InputAdornment,
  Tooltip,
  Autocomplete,
  Menu,
  Popover
} from '@mui/material';
import { PersonAdd, Delete, People, Visibility, Edit, Refresh, ContentCopy, MoreVert, KeyboardArrowDown } from '@mui/icons-material';
import { folderAPI, userAPI } from '../services/api';
import ConfirmModal from './ConfirmModal';
import EditUserDialog from './EditUserDialog';
import { useToast } from '../contexts/ToastContext';

function UserManagement({ user, onViewAsUser }) {
  const [users, setUsers] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [createNewFolder, setCreateNewFolder] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [actionMenu, setActionMenu] = useState({ anchorEl: null, user: null });
  const [folderPopup, setFolderPopup] = useState({ anchorEl: null, user: null, selectedFolders: [] });
  const [savingFolderPopup, setSavingFolderPopup] = useState(false);
  const { success, error: showError } = useToast();
  const folderOptions = folders
    .map((f) => f?.disk_name || f?.name)
    .filter(Boolean);
  const normalizeFolderValues = (values) => (Array.isArray(values) ? values.filter(Boolean) : []);
  const getFolderOptionLabel = (option) => {
    if (typeof option === 'string') return option;
    if (option && typeof option === 'object') {
      return option.label || option.disk_name || option.name || '';
    }
    return '';
  };
  
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'user',
    folders: []
  });

  const generatePassword = () => {
    const length = 16;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + special;
    
    let password = '';
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    setFormData({ ...formData, password });
    success('Lösenord genererat!');
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(formData.password);
    success('Lösenord kopierat!');
  };

  useEffect(() => {
    loadUsers();
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const response = await folderAPI.getAll();
      const sorted = [...response.data].sort((a, b) =>
        (a.original_name || a.disk_name || a.name).localeCompare(
          b.original_name || b.disk_name || b.name,
          'sv'
        )
      );
      setFolders(sorted);
      // Set first folder as default in form
      if (sorted.length > 0 && formData.folders.length === 0) {
        const firstFolder = sorted[0]?.disk_name || sorted[0]?.name;
        if (firstFolder) {
          setFormData(prev => ({ ...prev, folders: [firstFolder] }));
        }
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getAll();
      setUsers(response.data);
    } catch (err) {
      console.error('Error loading users:', err);
      if (err.response?.status === 403) {
        showError('Du har inte behörighet att se användare');
      } else {
        showError('Kunde inte ladda användare');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    const pwError = validatePassword(formData.password);
    if (pwError) {
      showError(pwError);
      return;
    }

    try {
      let folderList = formData.folders;

      // Create new folder if requested
      if (createNewFolder && newFolderName.trim()) {
        try {
          await folderAPI.create({ name: newFolderName.trim() });
          folderList = [...folderList, newFolderName.trim()];
          await loadFolders(); // Reload folders list
          success(`Mapp "${newFolderName}" skapad!`);
        } catch (err) {
          showError(err.response?.data?.error || 'Kunde inte skapa mapp');
          return;
        }
      }

      // Create user with folders
      await userAPI.create({ ...formData, folders: folderList });
      
      // Reset form
      const firstFolder = folders.length > 0 ? (folders[0]?.disk_name || folders[0]?.name) : '';
      setFormData({ username: '', name: '', email: '', password: '', role: 'user', folders: firstFolder ? [firstFolder] : [] });
      setNewFolderName('');
      setCreateNewFolder(false);
      setShowCreateForm(false);
      loadUsers();
      success('Användare skapad!');
    } catch (err) {
      showError(err.response?.data?.error || 'Kunde inte skapa användare');
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    
    try {
      await userAPI.delete(confirmDelete.id);
      loadUsers();
      success(`"${confirmDelete.username}" borttagen!`);
    } catch (err) {
      showError(err.response?.data?.error || 'Kunde inte ta bort användare');
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleUpdateRole = async (id, newRole) => {
    try {
      await userAPI.update(id, { role: newRole });
      loadUsers();
      success('Roll uppdaterad!');
    } catch (err) {
      showError(err.response?.data?.error || 'Kunde inte uppdatera roll');
    }
  };

  const handleUpdateFolder = async (id, newFolders) => {
    try {
      await userAPI.update(id, { folders: newFolders });
      loadUsers();
      success('Mappar uppdaterade!');
    } catch (err) {
      showError(err.response?.data?.error || 'Kunde inte uppdatera mappar');
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

  const openActionMenu = (event, selectedUser) => {
    setActionMenu({ anchorEl: event.currentTarget, user: selectedUser });
  };

  const closeActionMenu = () => {
    setActionMenu({ anchorEl: null, user: null });
  };

  const openFolderPopup = (event, selectedUser) => {
    setFolderPopup({
      anchorEl: event.currentTarget,
      user: selectedUser,
      selectedFolders: normalizeFolderValues(selectedUser?.folders)
    });
  };

  const closeFolderPopup = () => {
    setFolderPopup({ anchorEl: null, user: null, selectedFolders: [] });
  };

  const saveFolderPopup = async () => {
    if (!folderPopup.user) return;

    setSavingFolderPopup(true);
    try {
      await handleUpdateFolder(folderPopup.user.id, normalizeFolderValues(folderPopup.selectedFolders));
      closeFolderPopup();
    } finally {
      setSavingFolderPopup(false);
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <People /> Användarhantering
          </Typography>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Avbryt' : 'Skapa användare'}
          </Button>
        </Box>

        <Collapse in={showCreateForm}>
          <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
            <Typography variant="h6" gutterBottom>
              Skapa ny användare
            </Typography>
            <Box component="form" onSubmit={handleCreateUser}>
              <TextField
                fullWidth
                label="Användarnamn"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/\s/g, '') })}
                required
                margin="normal"
                inputProps={{ minLength: 3 }}
                helperText="Utan mellanslag. Används för inloggning."
              />
              <TextField
                fullWidth
                label="Namn"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                margin="normal"
                helperText="Personens visningsnamn (valfritt)"
              />
              <TextField
                fullWidth
                label="E-post"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                margin="normal"
              />
              <TextField
                fullWidth
                label="Lösenord"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onFocus={() => setShowPassword(true)}
                onBlur={() => setShowPassword(false)}
                required
                margin="normal"
                inputProps={{ minLength: 12 }}
                helperText="Minst 12 tecken. Använd stora och små bokstäver, siffror och specialtecken. Klicka på 🔄 för att generera."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {formData.password && (
                        <Tooltip title="Kopiera lösenord">
                          <IconButton 
                            onClick={copyPassword} 
                            edge="end" 
                            size="small"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Generera säkert lösenord">
                        <IconButton 
                          onClick={generatePassword} 
                          edge="end" 
                          size="small"
                          color="primary"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <Refresh fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Roll</InputLabel>
                <Select
                  value={formData.role}
                  label="Roll"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <MenuItem value="user">Användare</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
              
              {formData.role === 'user' && (
                <>
                  <Autocomplete
                    multiple
                    options={folderOptions}
                    value={normalizeFolderValues(formData.folders)}
                    onChange={(e, newValue) => setFormData({ ...formData, folders: normalizeFolderValues(newValue) })}
                    getOptionLabel={getFolderOptionLabel}
                    isOptionEqualToValue={(option, value) => getFolderOptionLabel(option) === getFolderOptionLabel(value)}
                    renderTags={(value, getTagProps) =>
                      normalizeFolderValues(value).map((option, index) => (
                        <Chip label={getFolderOptionLabel(option)} size="small" {...getTagProps({ index })} />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Mappar" margin="normal" />
                    )}
                  />
                  <Button
                    size="small"
                    onClick={() => setCreateNewFolder(!createNewFolder)}
                    sx={{ mt: 0.5 }}
                  >
                    {createNewFolder ? 'Avbryt ny mapp' : '+ Skapa ny mapp...'}
                  </Button>
                  
                  {createNewFolder && (
                    <TextField
                      fullWidth
                      label="Namn på ny mapp"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      required
                      margin="normal"
                      helperText="Ange namn på den nya mappen"
                    />
                  )}
                </>
              )}
              
              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{ mt: 2 }}
                startIcon={<PersonAdd />}
              >
                Skapa användare
              </Button>
            </Box>
          </Paper>
        </Collapse>

        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table
            size="small"
            sx={{
              width: '100%',
              '& .MuiTableCell-root': {
                px: { xs: 0.75, sm: 1 },
                py: 0.75
              }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell><strong>Anvnamn</strong></TableCell>
                <TableCell><strong>Namn</strong></TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}><strong>E-post</strong></TableCell>
                <TableCell><strong>Roll</strong></TableCell>
                <TableCell><strong>Mappar</strong></TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}><strong>Skapad</strong></TableCell>
                <TableCell
                  align="right"
                  sx={{
                    position: 'sticky',
                    right: 0,
                    backgroundColor: 'background.paper',
                    zIndex: 2,
                    width: 90
                  }}
                >
                  <strong>Åtgärder</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell sx={{ width: { xs: 90, md: 110 }, maxWidth: { xs: 90, md: 110 }, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.username}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{u.name || ''}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'normal', overflowWrap: 'anywhere', minWidth: 240, maxWidth: 360 }}>
                    {u.email}
                  </TableCell>
                  <TableCell>
                    {u.role === 'superadmin' ? (
                      <Chip label="Superadmin" color="secondary" size="small" />
                    ) : (
                      <FormControl size="small" sx={{ minWidth: { xs: 80, sm: 120 } }}>
                        <Select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                        >
                          <MenuItem value="user">Användare</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.role === 'superadmin' || u.role === 'admin' ? (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    ) : (
                      <Button
                        size="small"
                        variant="text"
                        endIcon={<KeyboardArrowDown fontSize="small" />}
                        onClick={(event) => openFolderPopup(event, u)}
                        sx={{ minWidth: 0, px: 0.5 }}
                      >
                        Visa
                      </Button>
                    )}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{formatDate(u.created_at)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      position: 'sticky',
                      right: 0,
                      backgroundColor: 'background.paper',
                      zIndex: 1,
                      width: 90
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      {u.role !== 'superadmin' && (
                        <IconButton
                          color="primary"
                          onClick={(event) => openActionMenu(event, u)}
                          size="small"
                          title="Visa åtgärder"
                        >
                          <MoreVert />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Menu
          anchorEl={actionMenu.anchorEl}
          open={Boolean(actionMenu.anchorEl)}
          onClose={closeActionMenu}
        >
          {actionMenu.user?.role !== 'admin' && (
            <MenuItem
              onClick={() => {
                onViewAsUser(actionMenu.user);
                closeActionMenu();
              }}
            >
              <Visibility fontSize="small" sx={{ mr: 1 }} />
              Visa som användare
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              setEditUser(actionMenu.user);
              closeActionMenu();
            }}
          >
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Redigera användare
          </MenuItem>
          <MenuItem
            onClick={() => {
              setConfirmDelete(actionMenu.user);
              closeActionMenu();
            }}
            sx={{ color: 'error.main' }}
          >
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Ta bort användare
          </MenuItem>
        </Menu>

        <Popover
          open={Boolean(folderPopup.anchorEl)}
          anchorEl={folderPopup.anchorEl}
          onClose={closeFolderPopup}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <Box sx={{ p: 1.5, width: { xs: 280, sm: 420 }, maxWidth: '90vw' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Mappar för {folderPopup.user?.username}
            </Typography>
            <Autocomplete
              multiple
              size="small"
              options={folderOptions}
              value={normalizeFolderValues(folderPopup.selectedFolders)}
              onChange={(e, newValue) => setFolderPopup((prev) => ({ ...prev, selectedFolders: normalizeFolderValues(newValue) }))}
              disableCloseOnSelect
              getOptionLabel={getFolderOptionLabel}
              isOptionEqualToValue={(option, value) => getFolderOptionLabel(option) === getFolderOptionLabel(value)}
              renderTags={(value, getTagProps) =>
                normalizeFolderValues(value).map((option, index) => (
                  <Chip label={getFolderOptionLabel(option)} size="small" {...getTagProps({ index })} />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} variant="outlined" size="small" label="Välj mappar" />
              )}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
              <Button size="small" onClick={closeFolderPopup}>
                Avbryt
              </Button>
              <Button size="small" variant="contained" onClick={saveFolderPopup} disabled={savingFolderPopup}>
                Spara
              </Button>
            </Box>
          </Box>
        </Popover>

        <ConfirmModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDeleteUser}
          message={`Är du säker på att du vill ta bort användaren "${confirmDelete?.username}"?`}
          title="Ta bort användare"
        />

        <EditUserDialog
          open={!!editUser}
          onClose={() => setEditUser(null)}
          user={editUser}
          onUpdate={loadUsers}
        />
      </CardContent>
    </Card>
  );
}

export default UserManagement;
