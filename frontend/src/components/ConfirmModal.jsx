import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';

function ConfirmModal({ isOpen, onClose, onConfirm, message, title = 'Bekräfta' }) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <DialogTitle id="confirm-dialog-title">
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Avbryt
        </Button>
        <Button onClick={handleConfirm} color="error" variant="contained" autoFocus>
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmModal;
